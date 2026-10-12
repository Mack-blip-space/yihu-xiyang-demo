"""Generate a local private pilot credential without printing it to tool logs."""
from pathlib import Path
import hashlib
import secrets

folder = Path(__file__).resolve().parents[1] / '.private'
folder.mkdir(exist_ok=True)
token = secrets.token_urlsafe(32)
path = folder / ('tester-' + secrets.token_hex(4) + '.txt')
path.write_text('个人内测凭证（私下交给体验者）：\n' + token + '\n\n云环境变量 TESTER_TOKEN_HASHES 使用的值：\n' + hashlib.sha256(token.encode()).hexdigest() + '\n', encoding='utf-8')
print('Credential saved under .private/. Do not publish this folder.')
