from pathlib import Path
from pypdf import PdfReader
pdf = Path(r"c:\Users\RPC\Downloads\MÓDULO RRHH.pdf")
out = Path(r"c:\Users\RPC\Desktop\Choferes\Choferes_RPD-main\rrhh_extract.txt")
reader = PdfReader(str(pdf))
parts = [f"PAGES: {len(reader.pages)}"]
for i, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ""
    parts.append(f"\n--- PAGE {i} ---\n")
    parts.append(text)
out.write_text("\n".join(parts), encoding="utf-8")
print(f"OK {out}")
