from __future__ import annotations
import json
from pathlib import Path
import fitz  # PyMuPDF

MAX_PDF_BYTES = 100 * 1024 * 1024
MAX_PDF_PAGES = 1000
MIN_DPI = 72
MAX_DPI = 600
MAX_PAGE_PIXELS = 80_000_000


def render_pdf_pages(pdf_path: str, work_dir: Path, dpi: int = 200) -> dict:
    """Render each PDF page to PNG and extract raw text. Returns page metadata."""
    source_path = Path(pdf_path)
    if not source_path.is_file():
        raise ValueError("PDF input does not exist or is not a file")
    if source_path.stat().st_size > MAX_PDF_BYTES:
        raise ValueError("PDF input must be 100 MB or smaller")
    if not isinstance(dpi, int) or dpi < MIN_DPI or dpi > MAX_DPI:
        raise ValueError(f"DPI must be between {MIN_DPI} and {MAX_DPI}")
    pages_dir = work_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    if doc.page_count <= 0 or doc.page_count > MAX_PDF_PAGES:
        doc.close()
        raise ValueError(f"PDF must contain between 1 and {MAX_PDF_PAGES} pages")
    metadata = {"pdf_path": pdf_path, "page_count": doc.page_count, "pages": []}

    print(f"Rendering {doc.page_count} pages at {dpi} DPI...")
    for i in range(doc.page_count):
        page = doc[i]
        scale = dpi / 72
        page_pixels = page.rect.width * scale * page.rect.height * scale
        if page_pixels > MAX_PAGE_PIXELS:
            doc.close()
            raise ValueError(f"Page {i + 1} exceeds the raster pixel limit")
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
