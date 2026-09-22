import type { NormalizedMessage, StateValue } from "@/lib/types";

export type FieldSource = string;

export type StateMapping =
  | { mode: "last_user" }
  | { mode: "messages" }
  | { mode: "object"; fields: Record<string, string> };

export function lastOf(messages: NormalizedMessage[], role: string): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) return messages[index].content;
  }
  return "";
}

export function extractLabeled(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*[：:]\\s*([\\s\\S]*?)(?=\\n\\s*[^\\n]+\\s*[：:]|$)`);
  return text.match(pattern)?.[1]?.trim() ?? "";
}

export function assembleState(messages: NormalizedMessage[], mapping: StateMapping): StateValue {
  const lastUser = lastOf(messages, "user");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");

  if (mapping.mode === "last_user") return lastUser;
  if (mapping.mode === "messages") {
    return {
      message: lastUser,
      messages: messages.filter((message) => message.role !== "system").map((message) => `${message.role}: ${message.content}`),
    };
  }

  const next: Record<string, string> = {};
  for (const [key, source] of Object.entries(mapping.fields)) {
    next[key] = resolveSource(source, { lastUser, system, messages });
  }
  return next;
}

function resolveSource(
  source: FieldSource,
  ctx: { lastUser: string; system: string; messages: NormalizedMessage[] },
): string {
  if (source === "last_user") return ctx.lastUser;
  if (source === "system") return ctx.system;
  if (source === "all_messages") {
    return ctx.messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  }
  if (source.startsWith("label:")) {
    return extractLabeled(ctx.lastUser, source.slice(6)) || ctx.lastUser;
  }
  return ctx.lastUser;
}
