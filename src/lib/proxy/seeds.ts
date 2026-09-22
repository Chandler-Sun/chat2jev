import { ticketConversion, ticketSample, toolsConversion, toolsSample } from "@/lib/samples";
import { extractRequestPayload, normalizeRequest } from "@/lib/openai-request";
import { promptFingerprint, systemText } from "./slug";
import { jevRouteSchema, type JevRoute } from "./types";

function fingerprintOf(source: string): string {
  const normalized = normalizeRequest(extractRequestPayload(source));
  return promptFingerprint({
    system: systemText(normalized.messages),
    tools: normalized.tools,
    responseFormat: normalized.responseFormat,
  });
}

export const seedRoutes: JevRoute[] = [
  jevRouteSchema.parse({
    slug: "ticket-triage",
    title: ticketConversion.title,
    status: "active",
    fingerprint: fingerprintOf(ticketSample),
    questions: ticketConversion.questions,
    mapping: {
      mode: "object",
      fields: {
        message: "label:客户来信",
        refund_policy: "label:退款政策",
      },
    },
    synthesize: "json",
    fit: ticketConversion.fit,
    builtin: true,
    updatedAt: "2026-09-22T00:00:00.000Z",
  }),
  jevRouteSchema.parse({
    slug: "tool-router",
    title: toolsConversion.title,
    status: "active",
    fingerprint: fingerprintOf(toolsSample),
    questions: toolsConversion.questions,
    mapping: {
      mode: "object",
      fields: { utterance: "last_user" },
    },
    synthesize: "tool_call",
    primary: "tool",
    fit: toolsConversion.fit,
    builtin: true,
    updatedAt: "2026-09-22T00:00:00.000Z",
  }),
];
