export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "100.100.100.200",
]);

export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "服务地址不是合法 URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "服务地址只支持 http 或 https");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".metadata.google.internal")) {
    throw new HttpError(400, "这个地址不能作为模型服务");
  }
  return url;
}

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  assertFetchableUrl(trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/`);
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export async function readUpstreamError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `模型服务返回 ${response.status}`;
  try {
    const body = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof body.error === "string" && body.error) return body.error;
    if (body.error && typeof body.error === "object" && body.error.message) {
      return body.error.message;
    }
    if (body.message) return body.message;
  } catch {
    // Fall through to raw text.
  }
  return text.slice(0, 600);
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
