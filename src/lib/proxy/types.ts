import { z } from "zod";
import { questionsSchema } from "@/lib/types";
import type { Conversion } from "@/lib/types";
import type { StateMapping } from "./state-map";
import type { SynthesizeMode } from "./synthesize";

const fieldSourceSchema = z.union([
  z.literal("last_user"),
  z.literal("system"),
  z.literal("all_messages"),
  z.string().regex(/^label:.+$/, "字段来源需要是 last_user / system / all_messages 或 label:名称"),
]);

export const stateMappingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("last_user") }),
  z.object({ mode: z.literal("messages") }),
  z.object({
    mode: z.literal("object"),
    fields: z.record(z.string(), fieldSourceSchema),
  }),
]);

export const jevRouteSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/, "slug 需要是小写字母开头的短码"),
  title: z.string().min(1),
  status: z.enum(["active", "shadow", "disabled"]).default("active"),
  fingerprint: z.string().optional(),
  questions: questionsSchema,
  mapping: stateMappingSchema,
  synthesize: z.enum(["json", "choice_text", "tool_call"]).default("json"),
  primary: z.string().optional(),
  fit: z.enum(["judgment", "mixed", "generative"]).default("judgment"),
  builtin: z.boolean().optional(),
  updatedAt: z.string(),
});

export type JevRoute = z.infer<typeof jevRouteSchema>;
export type RouteStatus = JevRoute["status"];
export type ResolveVia = "header" | "model" | "fingerprint" | "none";

export function mappingFromConversion(conversion: Conversion): StateMapping {
  if (typeof conversion.state === "string") return { mode: "last_user" };
  if (Array.isArray(conversion.state)) return { mode: "messages" };
  const keys = Object.keys(conversion.state);
  if (keys.length === 0) return { mode: "last_user" };
  const fields: Record<string, "last_user"> = {};
  for (const key of keys) fields[key] = "last_user";
  return { mode: "object", fields };
}

export function routeFromConversion(input: {
  slug: string;
  conversion: Conversion;
  fingerprint?: string;
  mapping?: StateMapping;
  synthesize?: SynthesizeMode;
  primary?: string;
}): JevRoute {
  return jevRouteSchema.parse({
    slug: input.slug,
    title: input.conversion.title,
    status: input.conversion.fit === "generative" ? "shadow" : "active",
    fingerprint: input.fingerprint,
    questions: input.conversion.questions,
    mapping: input.mapping ?? mappingFromConversion(input.conversion),
    synthesize: input.synthesize ?? "json",
    primary: input.primary,
    fit: input.conversion.fit,
    updatedAt: new Date().toISOString(),
  });
}
