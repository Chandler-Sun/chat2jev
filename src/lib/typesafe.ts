import { HttpError, readUpstreamError } from "./http";
import { questionsSchema, stateSchema, formatZodError, type SystemOneResponse } from "./types";

const SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";

export async function evaluateSystemOne(input: {
  apiKey: string;
  model?: string;
  state: unknown;
  questions: unknown;
  signal?: AbortSignal;
}): Promise<SystemOneResponse> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new HttpError(400, "先填写 TypeSafe API Key");
  const state = stateSchema.safeParse(input.state);
  if (!state.success) throw new HttpError(400, formatZodError(state.error));
  const questions = questionsSchema.safeParse(input.questions);
  if (!questions.success) throw new HttpError(400, formatZodError(questions.error));

  const encoded = JSON.stringify({
    state: state.data,
    model: input.model?.trim() || "jev-latest",
    questions: questions.data,
  });
  if (encoded.length > 400_000) throw new HttpError(400, "State 和 Questions 加起来太长了");

  let lastError = "TypeSafe 没有返回结果";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(SYSTEM_ONE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: encoded,
      signal: AbortSignal.any([input.signal ?? new AbortController().signal, AbortSignal.timeout(45_000)]),
    });
    if (response.ok) return (await response.json()) as SystemOneResponse;
    lastError = await readUpstreamError(response);
    const overloaded = response.status === 429 || response.status === 529;
    if (!overloaded || attempt === 1) throw new HttpError(response.status, lastError);
    await delay(1200);
  }
  throw new HttpError(502, lastError);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
