# Chat2Jev

把 OpenAI 兼容的 chat completion 转成 TypeSafe System One（Jev）请求，并对照两边的结果：传统模型生成文字，Jev 给出可复用的 State / Questions 和概率判断。模型密钥由你填在浏览器里，只保存在本机。

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。在设置里填转换模型地址、模型和 Key，再填 TypeSafe Key。粘贴一段 chat completions 请求，或载入示例后点「转换成 Jev」，再运行对比。

- `npm test` 检查请求解析和问题结构
- `npm run build` 做生产构建

## 部署到 Cloudflare Workers

用 [OpenNext](https://opennext.js.org/cloudflare) 把 Next.js 打成 Worker。API 继续走 Node 兼容运行时，不要改成 `edge`。

```bash
cp .dev.vars.example .dev.vars
npm run preview    # 本地用 Wrangler 跑 Worker
npm run deploy     # 构建并发布到你的 Cloudflare 账号
```

代理路由的内置种子（工单、工具路由）始终可用。自定义路由在 Workers 上默认写内存，隔离重启后会丢。要持久化：

```bash
npx wrangler kv namespace create JEV_ROUTES
```

把返回的 id 写进 `wrangler.jsonc`：

```jsonc
"kv_namespaces": [{ "binding": "JEV_ROUTES", "id": "<id>" }]
```

本地 `npm run dev` 仍把自定义路由写到 `data/jev-routes.json`。
