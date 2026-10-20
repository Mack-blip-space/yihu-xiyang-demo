# 益护夕阳国内 AI 接口

该适配层复用现有 Worker 的 AI 校验、检索、回答约束和限额逻辑；仅开放 health 与 consult，不迁移家庭圈或咨询数据。

服务器部署位置：`C:\yihu-ai`。进程仅监听 `127.0.0.1:3187`，由原网站 HTTPS 下的 `/yihu-api/` 转发。计划任务 `YihuAI-Service` 负责开机启动。

私密配置：`C:\yihu-ai\cloud\ecs\private\config.json`。该目录仅管理员和 SYSTEM 可访问。

配置北京地域阿里云百炼按量付费 Key：
1. 在服务器远程桌面，以管理员身份打开上述 JSON 文件。
2. 仅将 `DASHSCOPE_API_KEY` 的空字符串替换为新密钥。
3. 保持 `MODEL_BASE_URL` 为控制台显示的北京业务空间专属地址 `https://ws-ser0h03wwlgrovt5.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`。
4. 待负责人验证前保持 `AI_ENABLED` 为字符串 `false`；启用时改成字符串 `true`。
5. 保存文件。服务每次请求读取配置，无需重启。不要将文件上传 GitHub，不要把 Key 发到聊天或云助手命令内容中。

账本存于同一私密目录的 `usage.sqlite`。新账本与原 Cloudflare 账本独立，迁移期间不要同时发布两个可用 AI 入口来扩大总调用额度。原家庭圈、工单、通知仍在 Cloudflare，仍受原网络可达性限制。

部署验证须包括：不走代理的 health、安卓 Origin 的 OPTIONS、有效凭证实问、错误凭证拒绝、连续调用限额、原网站返回正常。只通过 health 不代表 AI 回答已打通。
