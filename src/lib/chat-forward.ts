import { HttpError } from "./http";
import { extractRequestPayload, normalizeRequest } from "./openai-request";

export function buildChatForwardBody(source: string, fallbackModel: string): Record<string, unknown> {
  const normalized = normalizeRequest(extractRequestPayload(source));
  const requested = normalized.model?.trim() ?? "";
  const model = requested && !requested.startsWith("jev:") ? requested : fallbackModel.trim();
  if (!model) {
    throw new HttpError(400, "先填写转换模型名称，或在原请求里带上 model");
  }

  const body: Record<string, unknown> = {
    model,
    messages: normalized.messages,
    stream: false,
  };
  if (normalized.tools !== undefined) body.tools = normalized.tools;
  if (normalized.responseFormat !== undefined) body.response_format = normalized.responseFormat;
  return body;
}
