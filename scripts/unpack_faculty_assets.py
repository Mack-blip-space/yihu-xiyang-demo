"""Restore reviewed image assets from portable text chunks for CI builds."""
from pathlib import Path
import base64,hashlib,json
root=Path(__file__).resolve().parents[1]
pack=root/'assets-pack'
manifest=json.loads((pack/'manifest.json').read_text(encoding='utf-8'))
for row in manifest:
    dest=root/'dist/assets/faculty'/row['name']
    assert dest.suffix=='.webp' and dest.name==row['name']
    data=base64.b64decode(''.join((pack/name).read_text() for name in row['chunks']),validate=True)
    assert hashlib.sha256(data).hexdigest()==row['sha256']
    dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
print(f'Restored and verified {len(manifest)} reviewed image assets')
