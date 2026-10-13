# 益护夕阳：Cloudflare 免费内测部署

当前状态：用户已部署 Worker，确认电脑和手机健康检查通过，并已配置 D1 和环境变量。V0.4.1 支持项目 Cloudflare 地址；实际 AI 响应仍待开启后验证。旧版 V0.4 安卓安装包只接受 CloudBase 地址，需要更新。

## 1. 注册账号

打开 https://dash.cloudflare.com/sign-up ，使用自己的邮箱注册并完成邮箱验证。登录后进入 Workers & Pages。先使用 Workers Free，不购买域名、不升级付费套餐。如果首页要求添加域名，转到 Workers & Pages；本项目先使用自动分配的 workers.dev 地址。

账号密码、邮箱验证码和模型密钥都不需要发到聊天里。

## 2. 创建并测试 Worker

在 Workers & Pages 中创建应用，选择 Hello World Worker（按钮名称以当前页面为准），名称填 `yihu-ai-consult`，部署。进入代码编辑器，用 `cloud/cloudflare/worker.mjs` 的全部内容替换示例代码并部署。此文件没有外部依赖；不要上传原来的 CloudBase ZIP。

在分配的域名后添加 `/health`，例如 `https://yihu-ai-consult.你的子域名.workers.dev/health`。电脑、手机 Wi-Fi 和手机移动网络分别打开，应该出现包含 `yihu-ai-pilot` 的 JSON。此检查不调用模型、不产生模型费用，也不代表模型已配置成功。

如果手机打不开，先停在这一步反馈；不要为了未知的访问问题直接购买套餐。workers.dev 的实际连通性需要在使用者网络验证。

## 3. 创建持久调用限额数据库

在控制台创建 D1 数据库，名称 `yihu-ai-usage`。打开它的 Console，执行 `cloud/cloudflare/schema.sql` 中的三条 SQL（若控制台不支持一次多条，逐条执行）。

回到 Worker 的 Bindings，添加 D1 绑定：变量名必须为 `DB`，选择刚创建的数据库。代码用一次数据库写入同时检查并占用配额，避免并发请求突破限额。

## 4. 配置变量与 Secret

在 Worker 的 Settings → Variables and Secrets 中设置：

| 名称 | 类型 | 值 |
| --- | --- | --- |
| AI_ENABLED | Text | 先填 `false` |
| ALLOWED_ORIGINS | Text | `https://mack-blip-space.github.io,https://localhost` |
| DASHSCOPE_API_KEY | Secret | 你已准备的千问 API Key |
| TESTER_TOKEN_HASHES | Secret | 原本本地私有配置中的同名值，即个人内测凭证的 SHA-256 值 |

`TESTER_TOKEN_HASHES` 不是模型密钥，也不是个人内测凭证原文。本机 `.private/yihu-pilot-d1gitbboh2218c4a2/云函数环境变量-待填.json` 中已有该值；不要把这个私有文件上传 GitHub。App 体验者填写的是 `个人内测凭证.txt` 中的原文。

本 Worker 固定调用 `https://maas.qianwenaiapi.com/compatible-mode/v1/chat/completions`，模型 `qwen-plus`。不需要把 API Key 写进代码，也不使用 Cloudflare 自带的 Workers AI。

关闭 Worker 的请求日志持久采集，避免额外记录；应用代码本身不记录问题、回答或密钥。D1 只保存请求编号、凭证散列、日期和时间。Cloudflare 会参与处理问题内容，内测只使用虚构或充分脱敏的问题，不上传真实案件材料。

## 5. 启用与联调

完成连通性测试、数据库绑定和 Secret 配置后，把 `AI_ENABLED` 改为 `true` 并部署。服务地址为 Worker 域名加 `/api/consult`。把服务地址告知开发者即可，不要发送 Secret。

使用最新网页或 V0.4.1 安卓更新，再测试脱敏问题。旧版 V0.4 APK 无法直接接受此地址，不能以保存配置失败判断 Worker 故障。

项目限额：每个内测凭证每天最多 10 次、全项目每天最多 100 次、同一凭证间隔至少 10 秒；日期按北京时间。调用失败也占额度，避免失败重试无限消费。此限制只覆盖通过本 Worker 的调用，不能控制同一 API Key 在其他地方的消费。停止服务只需把 `AI_ENABLED` 改回 `false`。

## 费用和限制

Workers Free 当前每日 100,000 次请求、每请求 10ms CPU；等待网络响应不计 CPU，HTTP 请求没有固定墙钟时长上限，但连接和平台资源限制仍然适用。本实现等待模型最多 25 秒。实际运行的 CPU 用量需要部署后验证，本地测试不等于已通过 Cloudflare 运行验证。

Workers 和 D1 有免费额度，千问 API 仍按你购买的服务计费。免费服务不是永久或无限额度承诺。

官方参考：

- https://developers.cloudflare.com/workers/get-started/dashboard/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/

开发者命令行部署可参考同目录 `wrangler.jsonc`，先填真实 D1 database_id；模板占位符不能直接部署。当前以控制台操作为主。
