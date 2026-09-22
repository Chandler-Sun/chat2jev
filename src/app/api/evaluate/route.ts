import { HttpError, jsonError, readUpstreamError } from "@/lib/http";
import { questionsSchema, stateSchema, formatZodError } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";

type EvaluateBody = {
  apiKey?: string;
  model?: string;
  state?: unknown;
  questions?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateBody;
    const apiKey = body.apiKey?.trim() ?? "";
    const model = body.model?.trim() || "jev-latest";
    if (!apiKey) return jsonError(400, "先填写 TypeSafe API Key");

    const state = stateSchema.safeParse(body.state);
    if (!state.success) return jsonError(400, formatZodError(state.error));
    const questions = questionsSchema.safeParse(body.questions);
    if (!questions.success) return jsonError(400, formatZodError(questions.error));

    const payload = { state: state.data, model, questions: questions.data };
    const encoded = JSON.stringify(payload);
    if (encoded.length > 400_000) return jsonError(400, "State 和 Questions 加起来太长了");

    const response = await postSystemOne(apiKey, encoded, request.signal);
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

async function postSystemOne(apiKey: string, body: string, parentSignal: AbortSignal): Promise<unknown> {
  let lastError = "TypeSafe 没有返回结果";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(SYSTEM_ONE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.any([parentSignal, AbortSignal.timeout(45_000)]),
    });
    if (response.ok) return response.json();
    lastError = await readUpstreamError(response);
    const overloaded = response.status === 429 || response.status === 529;
    if (!overloaded || attempt === 1) {
      throw new HttpError(response.status, lastError);
    }
    await delay(1200);
  }
  throw new HttpError(502, lastError);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
