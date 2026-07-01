### 稳定工具列表（实验性）

LongCat 单次 `tools` 请求最多支持 **128 个 functions**。如果环境中启用了大量工具，可以开启 `longcat-copilot.experimental.stabilizeToolList` 来提高跨轮次的工具列表稳定性。

- **≤ 64 个已启用工具**：通常无需开启
- **64–128 个已启用工具**：如果工具列表在轮次间变化，可考虑开启
- **> 128 个已启用工具**：建议先禁用不常用的工具

[配置 Tools](command:workbench.action.chat.configureTools) · [打开 LongCat 设置](command:workbench.action.openSettings?%5B%22%40id%3Alongcat-copilot.experimental.stabilizeToolList%22%5D)

### 自定义 Base URL

默认：`https://api.longcat.chat`。仅在使用自托管或代理部署时修改。

### 模型 ID 覆盖

可通过 `longcat-copilot.modelIdOverrides` 覆盖发送给 API 的模型 ID。用于兼容第三方代理。
