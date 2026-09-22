# 代理 API

入口：`POST /api/v1/chat/completions`。请求体为带 `messages` 的 Chat Completions 风格 JSON。

## 匹配与调用

匹配优先级：`x-jev-slug` → `model: "jev:<slug>"` → 系统提示词、tools 和 response_format 的指纹。显式 slug 未找到时不会继续尝试指纹匹配。指纹匹配会跳过停用路由。

| 请求头 | 用途 |
| --- | --- |
| `x-jev-slug` | 显式路由 slug |
| `x-jev-mode` | `auto`（默认）、`jev-only` 或 `fallback` |
| `x-typesafe-key` | Jev 使用的 TypeSafe API Key |
| `x-jev-model` | TypeSafe 模型，默认 `jev-latest` |
| `x-llm-base-url` | 回退模型地址 |
| `x-llm-key` | 回退模型 API Key |
| `x-llm-model` | 请求体未提供 model 时使用的回退模型名 |
| `Authorization: Bearer ...` | 未提供专用 Key 请求头时的备用凭据 |

建议总是使用专用 Key 请求头，避免把同一 Bearer 凭据发送给不同供应商。

`jev-only` 在没有可用路由时返回 409；`auto` 在无可用路由且已配置回退地址或 Key 时调用 LLM；`fallback` 在配置了回退地址或 Key 时优先走 LLM，否则仍可能运行已匹配的 Jev 路由。实验性的 generative 路由还有适配度与状态判断，详见 `src/lib/proxy/dispatch.ts`。Jev 调用失败不会自动触发 LLM 回退。

响应头 `x-jev-engine`、`x-jev-via`、`x-jev-fingerprint` 表示实际引擎、匹配方式和指纹；匹配到路由时还包含 `x-jev-slug` 与 `x-jev-mode`（路由状态）。

## 兼容限制

- 当前只返回非流式 JSON；即使传入 `stream: true` 也不会输出 SSE。
- 输出可能是 JSON 文本、选项文本或工具调用，由路由的 synthesize 配置决定。
- Jev 回答是结构化判断；返回的 Chat Completions 外壳不代表具备通用文字生成能力。
- LLM 回退会重新构造消息，不能保留所有原始请求参数，也不完整透传 tools / response_format。
- 回退时优先使用请求体的 model，因此不要把 `jev:<slug>` 作为回退模型；混合调用请用 `x-jev-slug` 指定路由，并在请求体 model 中填写真实 LLM 模型。

## 路由管理

| 方法与路径 | 行为 |
| --- | --- |
| `GET /api/proxy/routes` | 列出内置与自定义路由 |
| `POST /api/proxy/routes` | 从 conversion 或完整路由对象创建 / 更新 |
| `GET /api/proxy/routes/:slug` | 获取路由 |
| `PATCH /api/proxy/routes/:slug` | 更新路由配置 |
| `DELETE /api/proxy/routes/:slug` | 删除自定义路由（内置 slug 不可删除） |
| `POST /api/proxy/inspect` | 用 source 或 payload 检查匹配；`run: true` 时实际调用模型 |

这些接口没有内置鉴权，完整的配置结构以 `src/lib/proxy/types.ts` 中的 Zod schema 为准。建议先在 `/proxy` 页面创建路由并查看实际配置。
