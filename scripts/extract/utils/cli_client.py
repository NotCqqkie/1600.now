from __future__ import annotations
import json
import os
import signal
import subprocess
import time
from pathlib import Path


class ContentFilterBlocked(Exception):
    """Raised when Anthropic's content moderation blocks the response.
    Caller should retry with a smaller / different input rather than retrying as-is."""


class ClaudeCLIClient:
    """Client that uses the local `claude` CLI (subscription-based) instead of API keys.

    Each call spawns `claude -p` with --output-format json. Image inputs are passed by
    embedding their absolute paths in the prompt and adding the parent dir via --add-dir,
    so claude reads them via its Read tool.
    """

    def __init__(self, model: str = "sonnet", rpm: int = 30, allow_dirs: list[str] | None = None,
                 timeout_seconds: int = 300, max_consecutive_failures_before_pause: int = 3):
        self.model = model
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
        # Resolve image paths
        abs_paths = [str(Path(p).resolve()) for p in image_paths]
        # Auto-add parent dirs to allow list
        for p in abs_paths:
            self.add_allow_dir(str(Path(p).parent))

        # Build prompt with embedded image paths
        path_block = "\n".join(f"- {p}" for p in abs_paths)
        full_prompt = (
            f"{system}\n\n"
            f"Read the following image file(s) using the Read tool, then respond:\n"
            f"{path_block}\n\n"
            f"After reading the image(s), answer this:\n\n{text}\n\n"
            f"Return ONLY the requested JSON. No prose, no markdown fences, no explanation."
        )

        cmd = [
            "claude", "-p",
            "--model", self.model,
            "--output-format", "json",
            "--permission-mode", "bypassPermissions",
        ]
        for d in self.allow_dirs:
            cmd.extend(["--add-dir", d])

        for attempt in range(retries):
            self._wait_for_rate_limit()
            # Adaptive backoff: when the CLI is degrading, give it more breathing room.
            if self.consecutive_failures >= self.max_consecutive_failures_before_pause:
                cooldown = min(60, 10 * (self.consecutive_failures - self.max_consecutive_failures_before_pause + 1))
                print(f"    [cooldown {cooldown}s after {self.consecutive_failures} consecutive failures]")
                time.sleep(cooldown)
            try:
                result = _run_with_proc_group_kill(
                    cmd, full_prompt, timeout=self.timeout_seconds,
                )
                self.last_call = time.time()

                # Try to parse stdout as JSON regardless of rc — claude CLI sometimes
                # returns rc=1 with the actual error message in stdout JSON.
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
                    raise RuntimeError(f"claude CLI failed: {err}")

                if parsed.get("is_error") or result.returncode != 0:
                    err_msg = parsed.get("result", "") or result.stderr[:500]
                    # Detect content-filter false positives — these won't succeed on retry
                    if "content filtering" in err_msg.lower() or "blocked by" in err_msg.lower():
                        raise ContentFilterBlocked(err_msg)
                    if attempt < retries - 1:
                        wait = 5 * (2 ** attempt)
                        print(f"    Claude error, retrying in {wait}s: {err_msg[:200]}")
                        time.sleep(wait)
                        continue
                    raise RuntimeError(f"claude returned error: {err_msg[:300]}")

                self.call_count += 1
                self.consecutive_failures = 0  # success — reset failure counter
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
                # Don't count as a CLI degradation signal — re-raise so caller can fall back
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
    """Run subprocess in its own process group; on timeout, kill the entire tree.

    `claude -p` spawns Node child processes that survive a parent SIGTERM. Without this,
    a hung claude run leaks processes that pile up across calls until macOS gets unhappy.
    Putting the child in a new session and signalling the whole group fixes that.
    """
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,  # claude becomes its own process group leader
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
