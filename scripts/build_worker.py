"""Build the dependency-free Cloudflare dashboard upload from reviewed modules."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1] / 'cloud/cloudflare'
parts = []
for name in ('knowledge.mjs', 'retrieval.mjs', 'family.mjs', 'tickets.mjs', 'push.mjs', 'worker.mjs'):
    parts.append(re.sub(r'^import .*?;\s*', '', (root / name).read_text(encoding='utf-8'), flags=re.M))
(root / 'worker-bundle.mjs').write_text('\n'.join(parts), encoding='utf-8')
print('Built cloud/cloudflare/worker-bundle.mjs')
