# Changelog

All notable changes to the "LongCat v2 for Copilot Chat" extension will be documented in this file.

## [0.1.1] - 2026-07-02

### 修复

- **双重计数修复** — 流式 API 的 usage 事件是累计值，之前被重复叠加导致估算远高于实际（已修复为替换而非累加）
- **余额扣减修复** — 修复缓存命中也被扣减余额的问题，现在仅「未缓存输入 + 输出」从手动余额中扣除
- **状态栏即时刷新** — 设置手动余额/视觉代理后现在立即更新状态栏，无需等待下一次请求

### 改进

- **设置页修复** — 修复描述字段中 `%token%` 显示异常和标签重叠问题，改为内联描述和平铺配置项
- **单位统一** — 状态栏和悬停全部改用「万」为单位，与官方 LongCat 用量显示一致
- **价格配置** — 从嵌套表格改为独立数字输入框，避免悬停时显示重叠
- **视觉代理图标** — 改用 `$(device-camera)` codicon，与状态栏其他图标风格统一
- **悬停链接** — 末行改为纯文字描述，不再显示裸露的图标占位符

## [0.1.0] - 2026-07-01

### Added

- Register LongCat 2.0 as a LanguageModelChatProvider in Copilot Chat
- BYOK (Bring Your Own Key) authentication via SecretStorage
- Thinking mode support with configurable effort levels
- Vision proxy — convert image attachments to text via a secondary model
- Agent mode: file edits, terminal, search, Git, MCP, and Skills fully supported
- Token-based balance tracking with status bar integration
- Cross-session balance cache persistence
- Manual balance input (万 tokens unit, 1 decimal place)
- bilingual UI (English — Chinese)
- Welcome walkthrough for first-time setup
- Output channel logging with three debug levels
