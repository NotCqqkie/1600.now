from __future__ import annotations
import json
from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image
from ..utils.cli_client import RateLimitedClient, parse_json_response

BBOX_PROMPT = """This page contains a question with a figure (graph, chart, diagram, or image).

Identify the bounding box of the figure in pixel coordinates relative to the full page image.
Return JSON: {"x0": int, "y0": int, "x1": int, "y1": int}
where (x0, y0) is top-left and (x1, y1) is bottom-right.

Only return the bounding box for the main figure/graph, not the question text or answer choices.
If there are multiple figures, return an array of bounding boxes.
If no figure is found, return null."""


def extract_figures(
    pdf_path: str,
    metadata: dict,
    all_questions: dict[str, list[dict]],
    client: RateLimitedClient,
    output_dir: Path,
    question_ids: dict[str, dict[int, str]],
    dpi: int = 300,
) -> dict[str, dict]:
    """Extract figures from questions that have them. Returns image map entries."""
    image_map = {}
    figures_dir = output_dir / "images"
    figures_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)

    for section_id, questions in all_questions.items():
        for q in questions:
            if not q.get("has_figure") and not q.get("choice_has_figure"):
                continue

            q_num = q["question_number"]
            q_id = question_ids.get(section_id, {}).get(q_num)
            if not q_id:
                continue

            # Find which page this question is on by searching raw text
            target_page = None
            for p in metadata["pages"]:
                raw = p.get("raw_text", "")
                if f"Question {q_num} of" in raw or f"question {q_num} of" in raw.lower():
                    target_page = p
                    break

            if not target_page:
                print(f"  WARNING: Could not find page for question {q_num} in {section_id}")
                continue

            page_idx = target_page["page_num"] - 1

            # Try extracting embedded images first
            page = doc[page_idx]
            page_images = page.get_images()

            if page_images:
                # Extract the largest embedded image (likely the figure)
                best_img = None
                best_size = 0
                for img_info in page_images:
                    xref = img_info[0]
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        size = pix.width * pix.height
                        if size > best_size and size > 5000:  # skip tiny icons
                            best_img = pix
                            best_size = size
                        elif best_img is not pix:
                            pass  # let pix be garbage collected
                    except Exception:
                        continue

                if best_img:
                    img_filename = f"{q_id}_q_01.png"
                    img_path = figures_dir / img_filename
                    best_img.save(str(img_path))
                    image_map[q_id] = {
                        "questionImages": [{"src": f"/images/SAT-Style Questions/{img_filename}", "alt": q.get("figure_description", "")}]
                    }
                    print(f"  Extracted embedded image for Q{q_num} ({section_id})")
                    continue

            # Fallback: crop from high-res page render
            print(f"  Cropping figure for Q{q_num} ({section_id}) via bounding box...")
            page_img_path = target_page["image_path"]

            response = client.call_with_images(
                system="You are identifying figure locations in images. Return only valid JSON.",
                text=BBOX_PROMPT,
                image_paths=[page_img_path],
            )

            try:
                bbox = parse_json_response(response)
                if bbox is None:
                    print(f"    No figure found")
                    continue

                if isinstance(bbox, list):
                    bbox = bbox[0]

                # Render at high DPI for cropping
                hi_pix = page.get_pixmap(dpi=dpi)
                hi_path = figures_dir / f"_temp_page_{page_idx}.png"
                hi_pix.save(str(hi_path))

                # Scale bbox coordinates from original DPI to high DPI
                scale = dpi / 200  # original was rendered at 200 DPI
                x0 = int(bbox["x0"] * scale)
                y0 = int(bbox["y0"] * scale)
                x1 = int(bbox["x1"] * scale)
                y1 = int(bbox["y1"] * scale)

                img = Image.open(str(hi_path))
                cropped = img.crop((x0, y0, x1, y1))
                img_filename = f"{q_id}_q_01.png"
                img_path = figures_dir / img_filename
                cropped.save(str(img_path))

                image_map[q_id] = {
                    "questionImages": [{"src": f"/images/SAT-Style Questions/{img_filename}", "alt": q.get("figure_description", "")}]
                }
                print(f"    Cropped figure saved")

                hi_path.unlink(missing_ok=True)
            except Exception as e:
                print(f"    ERROR extracting figure: {e}")

    doc.close()

    map_path = output_dir / "figure_map.json"
    map_path.write_text(json.dumps(image_map, indent=2))
    print(f"Extracted {len(image_map)} figures total")
    return image_map
