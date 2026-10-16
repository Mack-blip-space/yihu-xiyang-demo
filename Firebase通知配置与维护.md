# Firebase 消息通知配置与维护

## 当前用途

Firebase Cloud Messaging 只负责把概括提醒送到安卓设备。业务数据、家庭绑定和人工咨询仍由现有 Cloudflare Worker 与 D1 处理。网页端不注册推送。

安卓包名固定为 `cn.yihu.xiyang.demo`。Firebase 项目 ID 为 `yihu-xiyang-push`。更换包名、Firebase 项目或服务账号后，需要重新生成安卓配置并重新部署 Cloudflare Secret。

## Cloudflare 配置

Worker 需要以下三个变量：

| 名称 | 类型 | 内容 |
|---|---|---|
| `FIREBASE_PROJECT_ID` | 普通变量 | Firebase 项目 ID |
| `FIREBASE_CLIENT_EMAIL` | Secret | 发送通知的服务账号邮箱 |
| `FIREBASE_PRIVATE_KEY` | Secret | 服务账号 JSON 中的完整私钥 |

服务账号 JSON 只能保存在负责人电脑的 `.private/firebase/`，不能上传 GitHub、发到聊天或写入交接文档。若怀疑泄漏，立即在 Google Cloud 控制台删除该密钥并生成新密钥，同时更新 Cloudflare Secret。

D1 需执行 `cloud/cloudflare/push-schema.sql`。该表只保存通知订阅和发送状态，不保存咨询正文或家庭消息正文。

## 安卓配置

Firebase 安卓应用使用包名 `cn.yihu.xiyang.demo`。`google-services.json` 中的客户端标识会编译进 APK；服务端私钥绝不能进入安卓工程。构建前确认：

1. `android/app/google-services.json` 对应上述包名和项目。
2. `android/app/build.gradle` 已启用 Firebase Messaging。
3. `YihuPushPlugin.java` 与 `YihuMessagingService.java` 存在。
4. `npx cap copy android` 已把最新 `dist/` 复制到安卓资源目录。

## 日常检查

- Worker `/health` 的 `push` 应为 `true`。
- App“我的 → 消息通知”应能主动开启、暂停 8 小时和关闭。
- 锁屏文字只能是概括提醒，不能出现问题或回复正文。
- 发送失败时 App 下次同步会显示失败状态；无效 Firebase 令牌会从 D1 自动移除。
- 每次发布后用两部真机分别验证家庭求助、咨询回复和用户补充三类通知。

本功能不保证即时送达。紧急危险仍应拨打 110，家庭急事应直接电话联系。
