"""Package a self-contained review copy; originals and hosting configuration are excluded."""
from pathlib import Path
import zipfile, base64

root = Path(__file__).resolve().parent
dist = root / 'dist'
html = (dist / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="modules.css">', '<style>\n' + (dist / 'modules.css').read_text(encoding='utf-8') + '\n</style>')
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + (dist / 'styles.css').read_text(encoding='utf-8') + '\n</style>')
html = html.replace('<script defer src="content.js"></script>', '')
html = html.replace('<script defer src="features.js"></script>', '')
html = html.replace('<script defer src="app.js"></script>', '')
html = html.replace('<script defer src="mobile.js"></script>', '')
for name in ['faculty-data.js', 'modules-data.js', 'modules.js', 'module-actions.js', 'faculty.js', 'ai.js']:
    html = html.replace(f'<script defer src="{name}"></script>', '')
scripts = '\n'.join((dist / name).read_text(encoding='utf-8') for name in ['content.js', 'features.js', 'mobile.js', 'faculty-data.js', 'modules-data.js', 'modules.js', 'module-actions.js', 'faculty.js', 'ai.js', 'app.js'])
html = html.replace('</body>', '<script>\n' + scripts + '\n</script>\n</body>')
html=html.replace('<link rel="stylesheet" href="faculty.css">', '<style>'+ (dist/'faculty.css').read_text(encoding='utf-8')+'</style>')
for image in (dist/'assets/faculty').glob('*.webp'):
    html=html.replace(image.relative_to(dist).as_posix(), 'data:image/webp;base64,'+base64.b64encode(image.read_bytes()).decode())
single = root / '益护夕阳-双击体验.html'
single.write_text(html, encoding='utf-8')
archive = root / '益护夕阳-初版演示包.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in [single, root / 'README.md', root / '更新记录-V0.4.md', root / '更新记录-V0.4.1.md', root / '更新记录-V0.4.2.md', root / 'Cloudflare免费部署指引.md', root / '云服务与AI开通指引.md', root / '内容交接清单.md', root / '安卓开发与交付说明.md', root / 'build-demo.py', *dist.rglob('*'), *(root / '交接材料').rglob('*')]:
        if not path.is_file():
            continue
        z.write(path, path.relative_to(root))
print('Created self-contained HTML and review ZIP in project directory.')
