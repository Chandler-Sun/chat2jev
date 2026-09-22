import { HttpError } from "./http";
import type { NormalizedMessage, NormalizedRequest } from "./types";

const SENSITIVE_KEY = /api[_-]?key|authorization|secret|password|credential/i;

export function extractRequestPayload(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new HttpError(400, "先粘贴一段 OpenAI 兼容请求");
  }

  const fromCurl = extractCurlBody(trimmed);
  const candidate = fromCurl ?? trimmed;
  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    try {
      return stripSensitiveKeys(JSON.parse(candidate) as unknown);
    } catch {
      throw new HttpError(400, "这段 JSON 无法解析");
    }
  }

  return stripSensitiveKeys({
    messages: [{ role: "user", content: candidate }],
  });
}

export function normalizeRequest(payload: unknown): NormalizedRequest {
  const clean = stripSensitiveKeys(payload);
  const notes: string[] = [];

  if (typeof clean === "string") {
    return {
      messages: [{ role: "user", content: clean }],
      notes,
    };
  }

  if (Array.isArray(clean)) {
    const messages = clean.map((item, index) => coerceMessage(item, index, notes)).filter(isMessage);
    if (messages.length === 0) {
      throw new HttpError(400, "没有找到可转换的消息");
    }
    return { messages, notes };
  }

  if (!clean || typeof clean !== "object") {
    throw new HttpError(400, "请求需要是 JSON 对象、消息数组，或一段纯文本");
  }

  const record = clean as Record<string, unknown>;
  const model = typeof record.model === "string" ? record.model : undefined;
  const sourceMessages = record.messages ?? record.input ?? record.prompt;

  let messages: NormalizedMessage[];
  if (typeof sourceMessages === "string") {
    messages = [{ role: "user", content: sourceMessages }];
  } else if (Array.isArray(sourceMessages)) {
    messages = sourceMessages
      .map((item, index) => coerceMessage(item, index, notes))
      .filter(isMessage);
  } else {
    throw new HttpError(400, "请求里没有 messages、input 或 prompt");
  }

  if (messages.length === 0) {
    throw new HttpError(400, "消息是空的");
  }

  const tools = record.tools ?? record.functions;
  const responseFormat = record.response_format ?? record.text;

  return {
    model,
    messages: messages.map((message) => ({
      ...message,
      content: clip(message.content, 12_000),
    })),
    tools: tools === undefined ? undefined : clipUnknown(tools),
    responseFormat: responseFormat === undefined ? undefined : clipUnknown(responseFormat),
    notes,
  };
}

function extractCurlBody(input: string): string | null {
  if (!/\bcurl\b/.test(input)) return null;
  const flagged = input.match(/(?:--data(?:-raw|-binary)?|-d)\s+'([\s\S]*?)'/);
  if (flagged) return flagged[1].trim();
  const doubleQuoted = input.match(/(?:--data(?:-raw|-binary)?|-d)\s+"([\s\S]*?)"/);
  if (doubleQuoted) return doubleQuoted[1].trim();
  return null;
}

function coerceMessage(item: unknown, index: number, notes: string[]): NormalizedMessage | null {
  if (typeof item === "string") {
    return { role: "user", content: item };
  }
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role : "user";
  const content = contentToText(record.content ?? record.text, index, notes);
  if (!content.trim()) return null;
  return { role, content };
}

function contentToText(content: unknown, index: number, notes: string[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (typeof part === "string") {
        parts.push(part);
        continue;
      }
      if (!part || typeof part !== "object") continue;
      const record = part as Record<string, unknown>;
      const type = typeof record.type === "string" ? record.type : "";
      if (type === "image_url" || type === "input_image" || type === "image") {
        notes.push(`第 ${index + 1} 条消息含图片。Jev 目前只接受文本，图片已跳过。`);
        continue;
      }
      if (typeof record.text === "string") parts.push(record.text);
      else if (typeof record.content === "string") parts.push(record.content);
    }
    return parts.join("\n");
  }
  if (content && typeof content === "object") {
    return JSON.stringify(content);
  }
  return "";
}

function stripSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitiveKeys);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = stripSensitiveKeys(child);
  }
  return out;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…（已截断）`;
}

function clipUnknown(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (!text || text.length <= 12_000) return value;
  return { truncated: true, preview: text.slice(0, 12_000) };
}

function isMessage(value: NormalizedMessage | null): value is NormalizedMessage {
  return value !== null;
}
