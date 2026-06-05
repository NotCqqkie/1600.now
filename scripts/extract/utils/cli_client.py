from __future__ import annotations
import json
import os
import signal
import shlex
import subprocess
import time
from pathlib import Path


class ContentFilterBlocked(Exception):
    pass


class RateLimitedClient:
    def __init__(self, model: str = "default", rpm: int = 30, allow_dirs: list[str] | None = None,
                 timeout_seconds: int = 300, max_consecutive_failures_before_pause: int = 3):
        self.model = model
        self.command = os.environ.get("EXTRACTION_CLI", "model-cli")
        self.command_args = shlex.split(os.environ.get("EXTRACTION_CLI_ARGS", "-p --output-format json"))
        self.model_arg = os.environ.get("EXTRACTION_CLI_MODEL_ARG", "--model")
        self.allow_dir_arg = os.environ.get("EXTRACTION_CLI_ALLOW_DIR_ARG", "--add-dir")
        self.min_interval = 60.0 / rpm
        self.last_call = 0.0
        self.allow_dirs = list(allow_dirs or [])
        self.call_count = 0
        self.total_cost_usd = 0.0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cache_read_tokens = 0
        self.total_cache_creation_tokens = 0
        self.timeout_seconds = timeout_seconds
        self.consecutive_failures = 0
        self.max_consecutive_failures_before_pause = max_consecutive_failures_before_pause

    def _wait_for_rate_limit(self):
        elapsed = time.time() - self.last_call
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)

    def add_allow_dir(self, dir_path: str):
        if dir_path not in self.allow_dirs:
            self.allow_dirs.append(dir_path)

    def call_with_images(self, system: str, text: str, image_paths: list[str],
                         max_tokens: int = 8192, retries: int = 3) -> str:
        abs_paths = [str(Path(p).resolve()) for p in image_paths]
        for p in abs_paths:
            self.add_allow_dir(str(Path(p).parent))

        path_block = "\n".join(f"- {p}" for p in abs_paths)
        full_prompt = (
            f"{system}\n\n"
            f"Read the following image file(s), then respond:\n"
            f"{path_block}\n\n"
            f"After reading the image(s), answer this:\n\n{text}\n\n"
            f"Return ONLY the requested JSON. No prose, no markdown fences, no explanation."
        )

        cmd = [self.command, *self.command_args]
        if self.model and self.model != "default":
            cmd.extend([self.model_arg, self.model])
        for d in self.allow_dirs:
            if self.allow_dir_arg:
                cmd.extend([self.allow_dir_arg, d])

        for attempt in range(retries):
            self._wait_for_rate_limit()
            if self.consecutive_failures >= self.max_consecutive_failures_before_pause:
                cooldown = min(60, 10 * (self.consecutive_failures - self.max_consecutive_failures_before_pause + 1))
                print(f"    [cooldown {cooldown}s after {self.consecutive_failures} consecutive failures]")
                time.sleep(cooldown)
            try:
                result = _run_with_proc_group_kill(
                    cmd, full_prompt, timeout=self.timeout_seconds,
                )
                self.last_call = time.time()

                parsed = None
                try:
                    parsed = json.loads(result.stdout)
                except (json.JSONDecodeError, ValueError):
                    pass

                if parsed is None:
                    err = result.stderr[:500] or f"rc={result.returncode}, no parseable stdout"
                    if attempt < retries - 1:
                        wait = 5 * (2 ** attempt)
                        print(f"    CLI error, retrying in {wait}s: {err}")
                        time.sleep(wait)
                        continue
                    raise RuntimeError(f"model CLI failed: {err}")

                if parsed.get("is_error") or result.returncode != 0:
                    err_msg = parsed.get("result", "") or result.stderr[:500]
                    if "content filtering" in err_msg.lower() or "blocked by" in err_msg.lower():
                        raise ContentFilterBlocked(err_msg)
                    if attempt < retries - 1:
                        wait = 5 * (2 ** attempt)
                        print(f"    CLI error, retrying in {wait}s: {err_msg[:200]}")
                        time.sleep(wait)
                        continue
                    raise RuntimeError(f"model CLI returned error: {err_msg[:300]}")

                self.call_count += 1
                self.consecutive_failures = 0
                self.total_cost_usd += parsed.get("total_cost_usd", 0)
                usage = parsed.get("usage", {})
                self.total_input_tokens += usage.get("input_tokens", 0)
                self.total_output_tokens += usage.get("output_tokens", 0)
                self.total_cache_read_tokens += usage.get("cache_read_input_tokens", 0)
                self.total_cache_creation_tokens += usage.get("cache_creation_input_tokens", 0)

                return parsed.get("result", "")

            except subprocess.TimeoutExpired:
                self.consecutive_failures += 1
                if attempt < retries - 1:
                    print(f"    Timeout (failure #{self.consecutive_failures}), retrying...")
                    continue
                raise
            except ContentFilterBlocked:
                raise
            except Exception:
                self.consecutive_failures += 1
                raise

        raise RuntimeError("Max retries exceeded")

    def cost_summary(self) -> dict:
        return {
            "calls": self.call_count,
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "cache_read_tokens": self.total_cache_read_tokens,
            "cache_creation_tokens": self.total_cache_creation_tokens,
            "estimated_cost_usd": round(self.total_cost_usd, 4),
        }


def _run_with_proc_group_kill(cmd: list[str], stdin_text: str, timeout: int):
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = proc.communicate(input=stdin_text, timeout=timeout)
        return subprocess.CompletedProcess(cmd, proc.returncode, stdout=stdout, stderr=stderr)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        # Drain any output that landed before the kill, then re-raise as TimeoutExpired
        try:
            proc.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()
        raise


def parse_json_response(text: str):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1
        end = len(lines) - 1
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[start:end])
    return json.loads(text)
