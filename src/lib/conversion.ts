import { conversionSchema, formatZodError, isStateValue, type Conversion, type FieldNote, type StateValue } from "./types";

export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("模型没有返回 JSON 对象");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export function coerceConversionPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (record.conversion && typeof record.conversion === "object") return record.conversion;
  return record;
}

export function finalizeConversion(raw: unknown, extraWarnings: string[] = []): Conversion {
  const parsed = conversionSchema.safeParse(coerceConversionPayload(raw));
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  const conversion = parsed.data;
  for (const [id, question] of Object.entries(conversion.questions)) {
    if (question.instructions === "" || question.instructions === null) {
      throw new Error(`${id}.instructions: 问题不能是空的`);
    }
  }
  const warnings = unique([
    ...conversion.warnings,
    ...extraWarnings,
    ...leakageWarnings(conversion),
    ...pathWarnings(conversion),
  ]);
  return { ...conversion, warnings };
}

export function blankReplaceableState(state: StateValue, fields: FieldNote[]): StateValue {
  const paths = new Set(fields.filter((field) => field.replaceable).map((field) => field.path));
  if (paths.size === 0) return state;
  if (typeof state === "string") {
    return paths.has("") || paths.has("$") ? "" : state;
  }
  return blankAt(state, "", paths) as StateValue;
}

export function collectReplaceableStrings(state: StateValue, fields: FieldNote[]): string[] {
  const paths = new Set(fields.filter((field) => field.replaceable).map((field) => field.path));
  const found: string[] = [];
  visit(state, "", (path, value) => {
    if (typeof value === "string" && pathMatches(path, paths)) found.push(value);
  });
  if (typeof state === "string" && (paths.has("") || paths.has("$"))) found.push(state);
  return found;
}

function leakageWarnings(conversion: Conversion): string[] {
  const questionText = JSON.stringify(conversion.questions);
  const warnings: string[] = [];
  for (const blob of collectReplaceableStrings(conversion.state, conversion.fields)) {
    const trimmed = blob.trim();
    if (trimmed.length < 24) continue;
    if (questionText.includes(trimmed)) {
      warnings.push(
        `问题里仍包含实例原文「${trimmed.slice(0, 42)}」。问题应只引用 State 路径，这样换数据时不用改问题。`,
      );
    }
  }
  return warnings;
}

function pathWarnings(conversion: Conversion): string[] {
  if (typeof conversion.state === "string") return [];
  const questionText = JSON.stringify(conversion.questions);
  if (questionText.includes("`")) return [];
  return ["State 是结构化的，但问题没有用反引号路径指向字段。复用时建议写上，例如 `message`。"];
}

function blankAt(value: unknown, path: string, paths: Set<string>): unknown {
  if (path && paths.has(path)) return blankAllStrings(value);
  if (Array.isArray(value)) {
    return value.map((item, index) => blankAt(item, joinIndex(path, index), paths));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = blankAt(child, joinKey(path, key), paths);
    }
    return out;
  }
  return value;
}

function blankAllStrings(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (Array.isArray(value)) return value.map(blankAllStrings);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) out[key] = blankAllStrings(child);
    return out;
  }
  return value;
}

function visit(value: unknown, path: string, onNode: (path: string, value: unknown) => void) {
  onNode(path, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, joinIndex(path, index), onNode));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visit(child, joinKey(path, key), onNode);
    }
  }
}

function pathMatches(path: string, paths: Set<string>): boolean {
  if (paths.has(path)) return true;
  for (const target of paths) {
    if (target && (path === target || path.startsWith(`${target}.`) || path.startsWith(`${target}[`))) {
      return true;
    }
  }
  return false;
}

function joinKey(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function joinIndex(path: string, index: number): string {
  return `${path}[${index}]`;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function assertState(value: unknown): StateValue {
  if (!isStateValue(value)) {
    throw new Error("State 需要是字符串、对象或数组");
  }
  return value;
}
