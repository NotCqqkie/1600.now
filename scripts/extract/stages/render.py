from __future__ import annotations
import json
from pathlib import Path
import fitz  # PyMuPDF


def render_pdf_pages(pdf_path: str, work_dir: Path, dpi: int = 200) -> dict:
    """Render each PDF page to PNG and extract raw text. Returns page metadata."""
    pages_dir = work_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    metadata = {"pdf_path": pdf_path, "page_count": doc.page_count, "pages": []}

    print(f"Rendering {doc.page_count} pages at {dpi} DPI...")
    for i in range(doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(dpi=dpi)
        img_path = pages_dir / f"page_{i + 1:03d}.png"
        pix.save(str(img_path))

        raw_text = page.get_text("text")
        images = page.get_images()

        page_meta = {
            "page_num": i + 1,
            "image_path": str(img_path),
            "raw_text_snippet": raw_text[:300],
            "raw_text": raw_text,
            "embedded_image_count": len(images),
        }
        metadata["pages"].append(page_meta)

        if (i + 1) % 10 == 0:
            print(f"  Rendered {i + 1}/{doc.page_count}")

    doc.close()

    meta_path = work_dir / "page_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2))
    print(f"Done. Metadata saved to {meta_path}")
    return metadata
