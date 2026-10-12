# 益护夕阳 · App 体验版 V0.4

面向法学院团队评审的安卓 App 与网页版。原始项目书及 APP/app.txt 未修改，也未上传。

- [网页版](https://mack-blip-space.github.io/yihu-xiyang-demo/)
- [安卓 V0.4 安装包](https://mack-blip-space.github.io/yihu-xiyang-demo/downloads/yihu-xiyang-v0.4.apk)
- [固定最新版下载地址](https://mack-blip-space.github.io/yihu-xiyang-demo/downloads/yihu-xiyang-latest.apk)
- [本次功能与待办](更新记录-V0.4.md)
- [云服务与 AI 开通指引](云服务与AI开通指引.md)
- [法学院五模块内容补充清单](交接材料/V0.4五模块与AI内容补充.md)

## 当前能体验什么

默认大字版、热线拨号、每日反诈情景与小测验、安卓本机学习提醒、问答分类、分步线索记录、附件与导出、材料清单及快照完整性校验、FAQ、制度图示、公开案例资料、家人联系簿、社区联系方式和本机匿名分享。

AI 前端与百炼云函数接入代码已提供，**尚待账号开通和部署，尚未真实调用模型**。AI 体验凭证由后端校验，模型密钥只放云环境变量；App 只会在用户确认后发送当前问题。详情见配置指引。

记录、附件、联系人和分享目前只存当前设备，不同设备不共享。没有机构受理、在线志愿者接单、远程代填或实时风险通知。问题分类采用透明规则，不能当作法律定性。

依照此前确认，自动朗读保持关闭；收到审核通过的真人音频才显示播放器。语音填写可使用手机键盘语音输入，未接独立语音识别服务。

## 给队长演示

双击本地生成的“益护夕阳-双击体验.html”，或安装安卓包。离线体验包由下方命令生成，全部页面脚本和样式内嵌。联网 AI 需要 HTTPS 网页或安卓环境与有效服务配置。

建议依次体验：

1. 首页进入“反诈预警”，学习一个情景、回答练习题。
2. 进入“一键维权”，回答分类问题，带着分类填写虚构经过。
3. 添加一份测试附件，保存本机线索；到“我的 → 材料快照”保存副本并校验。
4. 打开“问法”，检索“诉讼费”；未配置云服务时不会伪造 AI 回答。
5. 查看制度流程、案例；添加虚构家人或服务联系方式；分享和评论均仅保存在本机。

不要使用真实案件或个人敏感材料测试。拨号按钮会打开设备拨号界面，拨出由用户确认。

## 本地开发与验证

```powershell
npm ci --ignore-scripts
npm run check
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

电脑访问 http://127.0.0.1:4173 。另一个终端可运行：

```powershell
python -X utf8 tests/smoke.py
python -X utf8 tests/features.py
python -X utf8 tests/modules.py
python -X utf8 tests/reminders.py
python -X utf8 build-demo.py
```

浏览器测试使用本机 Chrome 与 Python Playwright。tests/mobile.py 还需要已经下载的 V0.4 APK 和校验清单，它会核对 APK 内页面源码与插件；原生桥接测试使用模拟插件，不替代安卓真机测试。

GitHub Actions 自动生成 Android 工程，执行 assembleDebug、lintDebug，再发布网页和 APK。调试包适用于内部体验；仍需真机检查安装覆盖、文件选择、拨号、系统分享及通知送达。

## 文件位置

| 位置 | 用途 |
|---|---|
| dist/content.js | 原内容模板，文章及可选音频/配图 |
| dist/modules-data.js | 课堂、FAQ、公开案例、政策资料，待法学院审核 |
| dist/app.js、features.js、mobile.js | 原记录、匿名区、手机桥接 |
| dist/modules.js、module-actions.js、modules.css | 五模块页面与本机交互 |
| dist/ai.js | 用户主动发送的 AI 内测界面 |
| cloud/ai-consult | 带鉴权和配额控制的百炼代理云函数 |
| 交接材料 | 文案、配图、真人录音及审核交付要求 |
| scripts/prepare_android.py | 可重复生成的安卓版本、图标及配置 |
| 云服务与AI开通指引.md | 用户开通步骤与后端部署说明 |

清除网站数据、卸载 App 可能删除本机内容；重要材料先导出。快照、原记录和附件各自导出，不自动云备份。网页和安卓使用各自的存储空间，不能用一个设备的界面判断另一个设备已经同步。
