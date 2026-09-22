import { dispatchChatProxy } from "@/lib/proxy/dispatch";
import { HttpError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const result = await dispatchChatProxy(request, body);
    const headers = new Headers({
      "content-type": "application/json",
      "x-jev-engine": result.engine,
      "x-jev-via": result.via,
      "x-jev-fingerprint": result.fingerprint,
    });
    if (result.route) {
      headers.set("x-jev-slug", result.route.slug);
      headers.set("x-jev-mode", result.route.status);
    }
    return new Response(JSON.stringify(result.completion), { status: 200, headers });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonError(504, "上游超时了");
    }
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError(499, "请求已取消");
    }
    const message = error instanceof Error ? error.message : "代理失败";
    if (message === "fetch failed") return jsonError(502, "连不上上游服务");
    return jsonError(502, message);
  }
}
