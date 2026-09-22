# Chat2Jev

English | [简体中文](README.zh-CN.md)

Convert OpenAI-compatible Chat Completions requests into TypeSafe System One (Jev) **State / Questions**, compare generated text with structured judgments, and publish reusable question sets as proxy routes.

Chat2Jev is an independent, experimental workbench for local use or deployment in a trusted network. It is not an official OpenAI or TypeSafe product. The interface is currently primarily in Chinese.

## Features

- **Convert and compare**: Paste JSON, a message array, plain text, or a supported cURL request. Convert it into State / Questions, then compare Chat and Jev results and response times.
- **Edit and reuse**: Adjust State and Questions, and save question packs and workbench drafts in your browser.
- **Proxy lab**: Match routes by slug, a `jev:<slug>` model name, or a request fingerprint. Return JSON or tool calls in a Chat Completions-shaped response.
- **Built-in examples**: Ticket triage (`ticket-triage`) and tool selection (`tool-router`).

The Ideas page is a planned feature. The proxy provides partial compatibility: it does not support streaming and is not a complete replacement for the OpenAI API. Traditional Chat models remain better suited to free-form text generation.

## Run locally

Requires Node.js 22 and npm. The repository includes `.nvmrc`; if you use nvm, run `nvm use` first.

```bash
git clone https://github.com/Chandler-Sun/chat2jev.git
cd chat2jev
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open <http://localhost:3000>. In settings, enter your OpenAI-compatible service URL, model name, and API key, then your TypeSafe API key. The service URL can be a base URL, a URL ending in `/v1`, or a complete `/chat/completions` endpoint. Leave the conversion model key empty for local services that do not require authentication.

Load an example to inspect its existing State / Questions. Model calls occur when you run a conversion or comparison. You need your own working credentials, and calls may incur provider charges. Starting the app locally and running unit tests do not require API keys.

## Data handling and deployment boundaries

**During model calls, API keys are sent to this application's server and forwarded to the corresponding model service.** “Remember keys” is enabled by default and stores keys in plain text in the browser's `localStorage` for this site. Turn it off to stop persisting keys in settings. Clear the site's browser data to remove saved drafts, question packs, and settings.

Original request drafts are also saved in the browser. Remove real credentials and sensitive content before pasting requests. The parser's field filtering is not comprehensive redaction. Model providers receive the content needed for conversion or evaluation, subject to their own data policies.

The app currently has no built-in authentication, permission isolation, or rate limiting. Route listing and management endpoints share the same data. Node.js deployments allow custom upstream URLs, including private network addresses, so they should not be exposed directly to untrusted users. Read the [security notes](SECURITY.md) (Chinese) before deployment.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev -- --hostname 127.0.0.1` | Start local development |
| `npm run lint` | Run ESLint; warnings also fail the check |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run local unit tests without model calls |
| `npm run build` | Create a Next.js production build |
| `npm start -- --hostname 127.0.0.1` | Serve the production build |
| `npm run preview` | Build and preview the Cloudflare Worker |
| `npm run deploy` | Build and deploy to the current Cloudflare account |

Builds require network access because `next/font` downloads fonts from Google Fonts.

## Call the proxy

The proxy endpoint is `/api/v1/chat/completions`. This example uses the built-in ticket triage route and requires your own TypeSafe key:

```bash
export TYPESAFE_API_KEY='replace-with-your-key'
curl http://localhost:3000/api/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "x-typesafe-key: $TYPESAFE_API_KEY" \
  -H 'x-jev-mode: jev-only' \
  --data '{
    "model": "jev:ticket-triage",
    "messages": [{
      "role": "user",
      "content": "客户来信：连接失败三天了，希望退款。\n退款政策：集成故障可退。"
    }]
  }'
```

The sample describes a customer requesting a refund after three days of connection failures, with a policy allowing refunds for integration failures. Keep the Chinese labels `客户来信` (customer message) and `退款政策` (refund policy): the built-in route uses these exact labels to extract State fields.

See the [proxy API reference](docs/proxy-api.md) (Chinese) for headers, matching order, and compatibility limits.

## Deploy to Cloudflare Workers

The project uses OpenNext to build Next.js as a Worker. API routes use the Node-compatible runtime.

```bash
cp .dev.vars.example .dev.vars
npx wrangler login
npm run preview
# After checking the target account and configuring access controls:
npm run deploy
```

You can change the Worker name in `wrangler.jsonc`. `.dev.vars` is for local configuration; do not commit real credentials.

Built-in routes are always available. In a regular Node.js runtime, custom routes are written to `data/jev-routes.json`. Without a KV binding, Workers keep custom routes only in the current instance's memory; routes may disappear when the instance restarts or requests reach another instance. To enable persistence:

```bash
npx wrangler kv namespace create JEV_ROUTES
```

Add the returned namespace ID as a top-level field in `wrangler.jsonc`:

```json
"kv_namespaces": [{ "binding": "JEV_ROUTES", "id": "YOUR_NAMESPACE_ID" }]
```

All custom routes share one KV key. There is currently no coordination of writes across instances, so this storage is not suitable for concurrent route management by multiple users. For Node.js deployments, provide a writable, persistent directory; otherwise, storage may fall back to memory.

## Project structure

```text
src/app/          Pages and API routes
src/components/  Workbench, editors, and UI components
src/lib/         Request parsing, conversion, TypeSafe client, and tests
src/lib/proxy/   Route matching, State mapping, storage, and response assembly
src/tools/       Tool navigation registry
```

Built with Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and OpenNext.

## Contributing

Issues and improvements are welcome. See the [contribution guide](CONTRIBUTING.md) and review the [release checklist](docs/releasing.md) before publishing. These supporting documents are currently in Chinese. Please keep the English and Chinese READMEs in sync when changing shared instructions or feature descriptions.

## License

Licensed under the [MIT License](LICENSE). Third-party dependencies retain their respective licenses, and API services remain subject to their providers' terms.
