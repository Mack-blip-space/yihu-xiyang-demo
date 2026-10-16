"""Create the local-only volunteer workbench credential without printing the secret."""
from pathlib import Path
import hashlib
import secrets

root = Path(__file__).resolve().parents[1]
folder = root / '.private' / 'volunteer-workbench'
folder.mkdir(parents=True, exist_ok=True)
credential = folder / '志愿者工作台凭证.txt'
if credential.exists():
    token = credential.read_text(encoding='utf-8').splitlines()[1].strip()
else:
    token = secrets.token_urlsafe(32)
    credential.write_text('志愿者工作台凭证（只交给指定内测人员）：\n' + token + '\n', encoding='utf-8')
(folder / '部署哈希.txt').write_text(hashlib.sha256(token.encode()).hexdigest() + '\n', encoding='utf-8')
print('Volunteer credential is ready under .private/volunteer-workbench/. Secret was not printed.')
