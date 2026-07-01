### Stabilize Tool List (Experimental)

LongCat supports up to **128 functions** in one `tools` request. If your environment has many enabled tools, you may enable `longcat-copilot.experimental.stabilizeToolList` to improve tool list stability across turns.

- **≤ 64 enabled tools**: usually not needed
- **64–128 enabled tools**: consider enabling if tool lists change between turns
- **> 128 enabled tools**: disable rarely used tools first

[Configure Tools](command:workbench.action.chat.configureTools) · [Open LongCat setting](command:workbench.action.openSettings?%5B%22%40id%3Alongcat-copilot.experimental.stabilizeToolList%22%5D)

### Base URL

Default: `https://api.longcat.chat`. Change only when using a self-hosted or proxied deployment.

### Model ID Overrides

API model IDs sent to the endpoint can be overridden via `longcat-copilot.modelIdOverrides`. Useful for third-party API proxies.
