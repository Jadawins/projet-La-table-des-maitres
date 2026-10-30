"""Extract the frozen French SRD in column order for the provenance inventory.

Usage: python refonte/audit/extract-description-srd.py
Download the official PDF into refonte/.local/descriptions-review/SRD-fr-5.2.1.pdf
first. The PDF remains a local documentary input, not a new runtime dependency.
"""
from pathlib import Path
import hashlib
import json
import pypdfium2 as pdfium

base = Path(__file__).resolve().parent.parent
directory = base / '.local' / 'descriptions-review'
pdf = directory / 'SRD-fr-5.2.1.pdf'
reference = json.loads((base / 'audit' / 'spell-reference-2024.json').read_text(encoding='utf-8'))
assert hashlib.sha256(pdf.read_bytes()).hexdigest() == reference['sourcePdfSha256']
document = pdfium.PdfDocument(pdf)
pages = []
for page in document:
    width, height = page.get_size()
    textpage = page.get_textpage()
    left = textpage.get_text_bounded(25, 30, width / 2, height - 35)
    right = textpage.get_text_bounded(width / 2, 30, width - 25, height - 35)
    pages.append(left + '\n' + right)
    textpage.close()
    page.close()
document.close()
(directory / 'SRD-fr-5.2.1.txt').write_text('\f'.join(pages), encoding='utf-8')
print(f'{len(pages)} pages extracted; run node refonte/audit/audit-description-provenance.mjs')
