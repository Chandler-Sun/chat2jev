import { createHash } from "node:crypto";
import type { NormalizedMessage } from "@/lib/types";

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}(?:[tT ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?)?\b/g;
const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const LONG_NUM = /\b\d{8,}\b/g;

export function skeletonize(text: string): string {
  return text
    .replace(UUID, "<uuid>")
    .replace(ISO_DATE, "<date>")
    .replace(EMAIL, "<email>")
    .replace(LONG_NUM, "<num>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function toolNames(tools: unknown): string[] {
  if (!Array.isArray(tools)) return [];
  return tools
    .map((tool) => {
      if (!tool || typeof tool !== "object") return "";
      const record = tool as Record<string, unknown>;
      const fn =
        record.function && typeof record.function === "object"
          ? (record.function as Record<string, unknown>)
          : record;
      return typeof fn.name === "string" ? fn.name : "";
    })
    .filter(Boolean)
    .sort();
}

export function promptFingerprint(input: {
  system: string;
  tools?: unknown;
  responseFormat?: unknown;
}): string {
  const payload = JSON.stringify({
    system: skeletonize(input.system),
    tools: toolNames(input.tools),
    format: input.responseFormat ?? null,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function systemText(messages: NormalizedMessage[]): string {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
}

export function slugFromModel(model?: string): string | null {
  if (!model) return null;
  const match = model.trim().match(/^jev:(.+)$/i);
  return match?.[1] ?? null;
}
