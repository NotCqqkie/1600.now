from __future__ import annotations

import re
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
IMAGES_DIR = ROOT / "public/images/SAT-Style Questions"
QUESTION_IMAGE_MAP_PATH = ROOT / "src/data/questionImageMap.ts"
SAT_IMAGE_MANIFEST_PATH = ROOT / "src/data/satImageManifest.ts"
MODULES_DIR = ROOT / "src/data/modules"

MONTH_PREFIX_RE = re.compile(r"^(Aug|Dec|Jun|Mar|May|Nov|Oct|Sep)_")
QUESTION_ID_RE = re.compile(r'^  "([^"]+)": \{$')
QUESTION_IMAGE_SRC_RE = re.compile(r'^(\s*"src": "/images/SAT-Style%20Questions/)([^"]+)(",?)$')
CHOICE_IMAGE_SRC_RE = re.compile(r'^(\s*"[A-Za-z0-9]+": "/images/SAT-Style%20Questions/)([^"]+)(",?)$')


def build_new_name(question_id: str, kind: str, index: int, ext: str, choice_id: str | None = None) -> str:
    if kind == "question":
        stem = f"{question_id}_q_{index:02d}_FIX"
    else:
        stem = f"{question_id}_choice_{choice_id}_{index:02d}_FIX"
    return f"{stem}{ext}"


def rewrite_question_image_map() -> tuple[str, dict[str, str]]:
    lines = QUESTION_IMAGE_MAP_PATH.read_text(encoding="utf-8").splitlines()
    current_question_id: str | None = None
    question_image_index: dict[str, int] = {}
    choice_image_index: dict[tuple[str, str], int] = {}
    rename_map: dict[str, str] = {}
    existing_files = {path.name for path in IMAGES_DIR.iterdir() if path.is_file()}
    rewritten_lines: list[str] = []

    for line in lines:
        qid_match = QUESTION_ID_RE.match(line)
        if qid_match:
            current_question_id = qid_match.group(1)
            question_image_index.setdefault(current_question_id, 0)
            rewritten_lines.append(line)
            continue

        qsrc_match = QUESTION_IMAGE_SRC_RE.match(line)
        if qsrc_match and current_question_id:
            prefix, filename, suffix = qsrc_match.groups()
            if MONTH_PREFIX_RE.match(filename):
                question_image_index[current_question_id] += 1
                ext = Path(filename).suffix
                new_name = build_new_name(
                    current_question_id,
                    kind="question",
                    index=question_image_index[current_question_id],
                    ext=ext,
                )
                if filename in existing_files or new_name in existing_files:
                    rename_map[filename] = new_name
                    line = f'{prefix}{new_name}{suffix}'
            rewritten_lines.append(line)
            continue

        csrc_match = CHOICE_IMAGE_SRC_RE.match(line)
        if csrc_match and current_question_id:
            prefix, filename, suffix = csrc_match.groups()
            if MONTH_PREFIX_RE.match(filename):
                choice_id_match = re.match(r'^\s*"([^"]+)": ', line)
                if not choice_id_match:
                    raise ValueError(f"Could not parse choice id from line: {line}")
                choice_id = choice_id_match.group(1)
                choice_key = (current_question_id, choice_id)
                choice_image_index[choice_key] = choice_image_index.get(choice_key, 0) + 1
                ext = Path(filename).suffix
                new_name = build_new_name(
                    current_question_id,
                    kind="choice",
                    index=choice_image_index[choice_key],
                    ext=ext,
                    choice_id=choice_id,
                )
                if filename in existing_files or new_name in existing_files:
                    rename_map[filename] = new_name
                    line = f'{prefix}{new_name}{suffix}'
            rewritten_lines.append(line)
            continue

        rewritten_lines.append(line)

    return "\n".join(rewritten_lines) + "\n", rename_map


def rename_image_files(rename_map: dict[str, str]) -> None:
    duplicate_targets: dict[str, list[str]] = {}

    for old_name, new_name in rename_map.items():
        duplicate_targets.setdefault(new_name, []).append(old_name)

    conflicts = {target: sources for target, sources in duplicate_targets.items() if len(sources) > 1}
    if conflicts:
        raise ValueError(f"Multiple source files map to the same target: {conflicts}")

    for old_name, new_name in rename_map.items():
        old_path = IMAGES_DIR / old_name
        new_path = IMAGES_DIR / new_name
        if new_path.exists():
            continue
        if not old_path.exists():
            continue
        old_path.rename(new_path)


def drop_terminal_index_suffix(filename: str) -> str:
    stem = Path(filename).stem
    ext = Path(filename).suffix
    if re.search(r"_\d+$", stem):
        return re.sub(r"_\d+$", "", stem) + ext
    return filename


def build_module_image_rename_map() -> tuple[dict[str, str], dict[str, str]]:
    public_files = {path.name for path in IMAGES_DIR.iterdir() if path.is_file()}
    public_rename_map: dict[str, str] = {}
    source_rename_map: dict[str, str] = {}

    for path in sorted(MODULES_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, list):
            continue

        for question in data:
            question_id = question.get("id")
            images = question.get("images")
            if not question_id or not isinstance(images, list):
                continue

            question_image_index = 0
            for image in images:
                if not isinstance(image, dict):
                    continue
                raw_src = image.get("src") or image.get("local")
                if not raw_src:
                    continue

                source_name = Path(raw_src).name
                if not MONTH_PREFIX_RE.match(source_name):
                    continue

                public_name = source_name if source_name in public_files else drop_terminal_index_suffix(source_name)
                if public_name not in public_files and build_new_name(question_id, "question", question_image_index + 1, Path(source_name).suffix) not in public_files:
                    continue

                question_image_index += 1
                ext = Path(source_name).suffix
                new_name = build_new_name(question_id, "question", question_image_index, ext)
                public_rename_map[public_name] = new_name
                source_rename_map[source_name] = new_name

    return public_rename_map, source_rename_map


def rewrite_module_files(source_rename_map: dict[str, str]) -> None:
    if not source_rename_map:
        return
    pattern = re.compile("|".join(re.escape(name) for name in sorted(source_rename_map, key=len, reverse=True)))
    for path in sorted(MODULES_DIR.glob("*.json")):
        original = path.read_text(encoding="utf-8")
        updated = pattern.sub(lambda match: source_rename_map[match.group(0)], original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")


def rewrite_sat_image_manifest() -> str:
    image_paths = sorted(
        f'/images/SAT-Style%20Questions/{path.name}'
        for path in IMAGES_DIR.iterdir()
        if path.is_file() and path.name != ".DS_Store"
    )
    manifest_lines = [
        "// SAT-style image manifest.",
        "// Only paths listed here are guaranteed to exist in this repo.",
        "",
        "export const satImageManifest = new Set<string>([",
    ]
    manifest_lines.extend(f'  "{path}",' for path in image_paths)
    manifest_lines.extend([
        "]);",
        "",
    ])
    return "\n".join(manifest_lines)


def load_manifest_paths() -> set[str]:
    return {
        f'/images/SAT-Style%20Questions/{path.name}'
        for path in IMAGES_DIR.iterdir()
        if path.is_file() and path.name != ".DS_Store"
    }


def prune_stale_question_image_map_entries() -> int:
    manifest_paths = load_manifest_paths()
    lines = QUESTION_IMAGE_MAP_PATH.read_text(encoding="utf-8").splitlines()

    prefix_lines: list[str] = []
    entry_blocks: list[tuple[str, list[str]]] = []
    suffix_lines: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('  "') and line.endswith("{"):
            break
        prefix_lines.append(line)
        i += 1

    while i < len(lines):
        line = lines[i]
        if line == "};":
            suffix_lines = lines[i:]
            break

        block: list[str] = [line]
        depth = line.count("{") - line.count("}")
        i += 1
        while i < len(lines):
            current = lines[i]
            block.append(current)
            depth += current.count("{") - current.count("}")
            i += 1
            if depth == 0:
                break

        question_id_match = QUESTION_ID_RE.match(block[0])
        if not question_id_match:
            raise ValueError(f"Could not parse questionImageMap entry header: {block[0]}")
        entry_blocks.append((question_id_match.group(1), block))

    kept_blocks: list[list[str]] = []
    removed = 0
    for _question_id, block in entry_blocks:
        referenced_paths = []
        for line in block:
            match = re.search(r'/images/SAT-Style%20Questions/([^"]+)', line)
            if match:
                referenced_paths.append(f'/images/SAT-Style%20Questions/{match.group(1)}')
        if referenced_paths and all(path not in manifest_paths for path in referenced_paths):
            removed += 1
            continue
        kept_blocks.append(block)

    rewritten_lines = prefix_lines[:]
    for index, block in enumerate(kept_blocks):
        new_block = block[:]
        if index == len(kept_blocks) - 1 and new_block[-1].endswith(","):
            new_block[-1] = new_block[-1][:-1]
        rewritten_lines.extend(new_block)
    rewritten_lines.extend(suffix_lines)
    QUESTION_IMAGE_MAP_PATH.write_text("\n".join(rewritten_lines) + "\n", encoding="utf-8")
    return removed


def rename_unmapped_month_files() -> int:
    renamed = 0
    for path in sorted(IMAGES_DIR.iterdir()):
        if not path.is_file() or path.name == ".DS_Store":
            continue
        if not MONTH_PREFIX_RE.match(path.name):
            continue
        new_name = f"UNMAPPED_{path.stem}_FIX{path.suffix}"
        target = path.with_name(new_name)
        if target.exists():
            continue
        path.rename(target)
        renamed += 1
    return renamed


def main() -> None:
    rewritten_question_image_map, rename_map = rewrite_question_image_map()
    rename_image_files(rename_map)
    module_public_rename_map, module_source_rename_map = build_module_image_rename_map()
    rename_image_files(module_public_rename_map)
    unmapped_count = rename_unmapped_month_files()
    QUESTION_IMAGE_MAP_PATH.write_text(rewritten_question_image_map, encoding="utf-8")
    removed_stale_entries = prune_stale_question_image_map_entries()
    rewrite_module_files(module_source_rename_map)
    SAT_IMAGE_MANIFEST_PATH.write_text(rewrite_sat_image_manifest(), encoding="utf-8")
    print(
        f"Renamed {len(rename_map)} official SAT-style images and "
        f"{len(module_public_rename_map)} module-linked leftovers, plus "
        f"{unmapped_count} unmapped leftovers; pruned {removed_stale_entries} stale questionImageMap entries."
    )


if __name__ == "__main__":
    main()
