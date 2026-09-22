import { finalizeConversion, parseModelJson } from "@/lib/conversion";
import { HttpError, jsonError } from "@/lib/http";
import { completeChat, type ChatMessage } from "@/lib/llm";
import { extractRequestPayload, normalizeRequest } from "@/lib/openai-request";
import { CONVERSION_SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";

type ConvertBody = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  source?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConvertBody;
    const baseUrl = body.baseUrl?.trim() ?? "";
    const model = body.model?.trim() ?? "";
    const source = body.source ?? "";
    if (!baseUrl) return jsonError(400, "先填写常规模型的服务地址");
    if (!model) return jsonError(400, "先填写常规模型的名字");
    if (source.length > 500_000) return jsonError(400, "请求太长了，请先裁剪再拆分");

    const normalized = normalizeRequest(extractRequestPayload(source));
    const messages: ChatMessage[] = [
      { role: "system", content: CONVERSION_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          task: "把下面的 OpenAI 兼容请求拆成 State 和 Questions",
          request: normalized,
        }),
      },
    ];

    const first = await completeChat({
      baseUrl,
      apiKey: body.apiKey?.trim() ?? "",
      model,
      messages,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(70_000)]),
    });

    try {
      const conversion = finalizeConversion(parseModelJson(first.content), normalized.notes);
      return Response.json({ conversion, usage: first.usage, normalized });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "结构不符合";
      const repaired = await completeChat({
        baseUrl,
        apiKey: body.apiKey?.trim() ?? "",
        model,
        messages: [
          ...messages,
          { role: "assistant", content: first.content.slice(0, 20_000) },
          {
            role: "user",
            content: `上次的 JSON 没有通过校验。请只返回修正后的完整 JSON。\n\n${reason}`,
          },
        ],
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(70_000)]),
      });
      const conversion = finalizeConversion(parseModelJson(repaired.content), normalized.notes);
      return Response.json({ conversion, usage: repaired.usage ?? first.usage, normalized });
    }
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonError(504, "常规模型超时了，可以换一个更快的模型再试");
    }
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError(499, "请求已取消");
    }
    const message = error instanceof Error ? error.message : "拆分失败";
    if (message === "fetch failed") return jsonError(502, "连不上这个模型地址");
    return jsonError(502, message);
  }
}
