"""Read the CC BY French SRD in column order; no catalogue writes.

Usage: python extract-spell-columns.py official.pdf columns.json
Requires pypdfium2. The resulting text is evidence to compare, not a verdict.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pypdfium2 as pdfium

source, target = map(Path, sys.argv[1:3])
expected = '480604d949a3bb77f639cf31c1e9e1e7ebb04ae481d943db662ba546828d94bf'
digest = hashlib.sha256(source.read_bytes()).hexdigest()
if digest != expected:
    raise ValueError('Unexpected reference PDF: review it before extracting')
document = pdfium.PdfDocument(str(source))
pages = []
for number in range(114, 187):
    page = document[number - 1]
    width, height = page.get_size()
    textpage = page.get_textpage()
    columns = []
    for left, right in [(25, width / 2), (width / 2, width - 25)]:
        text = textpage.get_text_bounded(left=left, bottom=30, right=right, top=height-35)
        lines = text.splitlines()
        if lines and 'Document de Référence du Système' in lines[0]:
            lines.pop(0)
            if lines and re.fullmatch(r'\d+', lines[0]):
                lines.pop(0)
        text = '\n'.join(lines).replace('\x02', '')
        text = re.sub(r'([\wÀ-ÿ])-\s*\n([\wÀ-ÿ])', r'\1\2', text)
        columns.append(text)
    pages.append({'page': number, 'columns': columns})
target.write_text(json.dumps({'sourcePdfSha256': digest, 'pages': pages}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Extracted {len(pages)} pages in column order')
