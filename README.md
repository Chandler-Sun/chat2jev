# Jev Lab

把 OpenAI 兼容的对话请求拆成 TypeSafe System One 的两部分：可替换的 State，和可复用的 Questions。页面是 playground，模型密钥由你填在浏览器里，只保存在本机。

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。在页头填入常规模型的地址、模型和 Key，再填 TypeSafe Key。粘贴一段 chat completions 请求，或载入示例后点「拆分请求」。

- `npm test` 检查请求解析和问题结构
- `npm run build` 做生产构建
