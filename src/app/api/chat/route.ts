import { buildChatForwardBody } from "@/lib/chat-forward";
import { HttpError, jsonError } from "@/lib/http";
import { forwardChat } from "@/lib/llm";

export const runtime = "nodejs";

type ChatBody = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  source?: string;
};

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as ChatBody;
    const baseUrl = body.baseUrl?.trim() ?? "";
    if (!baseUrl) return jsonError(400, "先填写转换模型的服务地址");
    if (!body.source?.trim()) return jsonError(400, "先粘贴一段 chat completion 请求");

    const forwarded = buildChatForwardBody(body.source, body.model ?? "");
    const result = await forwardChat({
      baseUrl,
      apiKey: body.apiKey?.trim() ?? "",
      body: forwarded,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(70_000)]),
    });

    return Response.json({
      content: result.content,
      model: result.model ?? forwarded.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonError(504, "Chat 模型超时了，可以换一个更快的模型再试");
    }
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError(499, "请求已取消");
    }
    const message = error instanceof Error ? error.message : "Chat completion 失败";
    if (message === "fetch failed") return jsonError(502, "连不上这个模型地址");
    return jsonError(502, message);
  }
}
