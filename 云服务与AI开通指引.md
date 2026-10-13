# 益护夕阳：免费云服务与 AI 开通指引

## 当前账号配置更新（2026-10-13）

已创建 CloudBase 环境：`yihu-pilot-d1gitbboh2218c4a2`，地域待在控制台确认。用户提供的是付费 API，Base URL 为 `https://maas.qianwenaiapi.com/compatible-mode/v1`。该地址已核对千问 AI 平台[官方接入文档](https://platform.qianwenai.com/docs/api-reference/preparation/api-key)，云函数已增加精确域名支持。对于当前账号，`BAILIAN_BASE_URL` 直接使用此地址，不需要另外拼接北京业务空间域名。不要根据此地址猜测账号地域或认为有免费额度；下面的免费开通方案保留作原计划参考。

现有每人每日 10 次、全项目每日 100 次的限制是请求次数限制，不是人民币消费硬上限。当前保持 `AI_ENABLED=false`；部署及真实联调尚未进行。模型可用性和实际价格以当前账号的模型页为准。

方案已确认：腾讯云 CloudBase 免费环境 + 阿里云百炼 qwen-plus。核对日期：2026-10-13。你现在先完成下方「第一步、第二步」，不需要购买云服务器，也不需要把密钥发给我。

## 第一步：开通腾讯云免费环境

1. 打开 [CloudBase 控制台](https://tcb.cloud.tencent.com/)，注册腾讯云账号，按页面要求完成实名认证。账号应由你或项目负责人长期持有。
2. 创建环境，选择页面明确标价 **0 元的免费套餐**，名称可填 `yihu-pilot`，记录环境 ID 和地域。若没有免费选项，先停在该页告诉我页面文字，不购买替代套餐。
3. 不需要现在购买域名、短信、虚拟机或额外存储。
4. 进入用量页面，记下免费环境到期时间，设置个人续期提醒。官方当前为每月 3,000 资源点、每账号一个免费环境、单次续期 6 个月；不是无限免费。

[免费套餐说明](https://www.cloudbase.net/pricing) · [云函数快速开始](https://docs.cloudbase.net/cloud-function/quick-start)

## 第二步：开通百炼和模型免费额度

1. 打开 [阿里云百炼控制台](https://bailian.console.aliyun.com/)，注册阿里云账号，完成页面要求的身份认证和服务开通。
2. 选择 **华北 2（北京）**。免费额度、密钥和接口域名按地域区分。
3. 找到 `qwen-plus`，查看你账号实际获得的免费额度和有效期；开启该模型的 **免费额度用完即停**。没有额度时先不充值，告诉我显示情况。
4. 在密钥管理中新建项目专用 API Key。在创建弹窗复制 **API Host**，并记下业务空间 ID（WorkspaceId）。不要只复制网上旧版接口地址。
5. 密钥存入你自己的密码管理器，之后粘贴到腾讯云函数的环境变量；不要写进 GitHub、App、截图、交接表或聊天。

[获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key/) · [地域和 API Host](https://help.aliyun.com/zh/model-studio/regions/) · [免费额度用完即停](https://help.aliyun.com/zh/model-studio/new-free-quota)

完成后告诉我：**CloudBase 环境 ID、地域、是否显示免费套餐；百炼是否开通、qwen-plus 免费额度是否可用、是否开启用完即停**。这些信息足够继续配置，不需要 API Key。

## 第三步：部署本项目的内测 AI 云函数

本项目代码在 `cloud/ai-consult/`。当前是带个人体验凭证的封闭内测接口，不是公开服务的用户账号系统。云端尚未部署、尚未实际调用模型；本地测试不能替代部署后的验证。

1. 在 CloudBase 创建文档数据库集合 `yihu_ai_usage`，客户端权限设为 **禁止所有客户端读写**；仅云函数以服务端身份访问。数据库只保存配额计数与凭证哈希，不保存问题或回答。
2. 创建 Node.js 事件云函数 `yihu-ai-consult`，运行时选择 Node.js 18 或更高可用版本，入口 `index.main`，超时设为 40 秒。上传 `cloud/ai-consult/` 内文件并安装锁定依赖。
3. 配置下表环境变量，**先保持 `AI_ENABLED=false`**。

| 名称 | 值 |
|---|---|
| `AI_ENABLED` | 验证配置后改为 `true`；随时改回 `false` 停用 |
| `CLOUDBASE_ENV_ID` | 你的环境 ID |
| `DASHSCOPE_API_KEY` | 百炼北京地域 API Key，仅填云端 |
| `BAILIAN_BASE_URL` | `https://你的业务空间ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`，以控制台 API Host 为准 |
| `ALLOWED_ORIGINS` | `https://mack-blip-space.github.io,https://localhost`；只填实际允许的网页/App 来源，逗号分隔 |
| `TESTER_TOKEN_HASHES` | 每位体验者独立随机凭证的 SHA-256，英文逗号分隔 |

4. 用本机 `python scripts/create_tester_token.py` 生成体验凭证文件；只将文件中的哈希填进云环境变量。原始凭证私下交给指定体验者，**它不是百炼 API Key**。移除对应哈希即可撤销。请勿把该文件上传 GitHub。
5. 在 CloudBase 的 **HTTP 网关**新建路由 `/api/consult`，关联这个事件云函数。使用平台生成的 HTTPS 完整地址。函数自行校验个人内测凭证，不能删除这层校验；如果网关另外启用了平台登录鉴权，需要配套登录方案，不能直接冒充已登录用户。
6. 开启 `AI_ENABLED` 后，在 App「问法 → AI 咨询 → 配置内测服务」填写网关地址和本人的体验凭证。凭证只保留在当前页面内存，重开需重新填写。
7. 先问一个虚构问题。确认回答标有「AI 生成」、百炼调用统计有记录。再用错误凭证测试拒绝访问，确认数据库计数增加，关闭开关后请求被拒绝。

[HTTP 网关接入文档](https://docs.cloudbase.net/service/access-cloud-function) · [数据库事务](https://docs.cloudbase.net/database/transaction)

## 费用和限制

- 当前 qwen-plus 北京非思考、输入不超过 128K 的价格：输入 0.8 元/百万 Token、输出 2 元/百万 Token。按每次 2,000 输入、500 输出计算，1,000 次约 **2.6 元模型费**。这不是固定套餐，长问题、上下文及回答长度会改变费用。[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
- 当前内测接口固定：每个凭证每天最多 10 次，全项目每天最多 100 次，间隔至少 10 秒，每次最多 1,200 字问题、600 输出 Token。额度在云数据库事务中扣除，失败请求也占体验次数，避免重试放大开销。这不是精确人民币账单上限。
- 未授权请求不会调用模型，但仍可能产生网关/函数开销。免费环境资源耗尽可能影响可用性；免费额度不足时先暂停或评估套餐，不能保证永远 0 元。
- App 只发送用户明确勾选确认的当前问题，不自动上传附件、联系人或维权记录。代码不记录问答正文；模型提供商及云平台自身的数据处理以其服务条款为准。
- 内测凭证不能替代正式登录、老人授权、家人绑定、权限隔离、内容审核和告警送达机制。当前没有跨设备家庭守护、在线志愿者接单或机构提交。后续启用这些功能必须另行完成身份与授权流程。
- 尚无经法学院审核的知识库。AI 只作一般信息整理，明确标识未审核，不自动判定侵权或承诺维权结果。

## 后续上线前的接入顺序

先验证 AI 及费用控制；再接账号登录与家庭邀请确认；然后接咨询工单与志愿者权限；最后上线共享社区的审核与举报。法学院负责审核知识内容、确定真实合作机构和服务边界。当前本机数据不会因为配置 AI 自动迁移到云端。
