import { HttpError, jsonError } from "@/lib/http";
import { evaluateSystemOne } from "@/lib/typesafe";

export const runtime = "nodejs";

type EvaluateBody = {
  apiKey?: string;
  model?: string;
  state?: unknown;
  questions?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateBody;
    const response = await evaluateSystemOne({
      apiKey: body.apiKey ?? "",
      model: body.model,
      state: body.state,
      questions: body.questions,
      signal: request.signal,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonError(504, "TypeSafe 超时了，可以缩短 State 再试");
    }
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError(499, "请求已取消");
    }
    const message = error instanceof Error ? error.message : "调用 TypeSafe 失败";
    return jsonError(502, message);
  }
}
