import { completeChat } from "@/lib/llm";
import { extractRequestPayload, normalizeRequest } from "@/lib/openai-request";
import { evaluateSystemOne } from "@/lib/typesafe";
import { HttpError } from "@/lib/http";
import type { NormalizedRequest, SystemOneResponse } from "@/lib/types";
import { assembleState } from "./state-map";
import { promptFingerprint, slugFromModel, systemText } from "./slug";
import { listRoutes } from "./store";
import { synthesizeChatCompletion, type ChatCompletion } from "./synthesize";
import type { JevRoute, ResolveVia } from "./types";

export type ProxyMode = "auto" | "jev-only" | "fallback";

export type ProxyResult = {
  via: ResolveVia;
  fingerprint: string;
  route?: JevRoute;
  engine: "jev" | "llm";
  state?: unknown;
  answers?: SystemOneResponse["answers"];
  completion: ChatCompletion;
};

function header(request: Request, name: string): string {
  return request.headers.get(name)?.trim() ?? "";
}

export function readProxyMode(request: Request): ProxyMode {
  const mode = header(request, "x-jev-mode").toLowerCase();
  if (mode === "jev-only" || mode === "fallback") return mode;
  return "auto";
}

export function resolveFingerprint(normalized: NormalizedRequest): string {
  return promptFingerprint({
    system: systemText(normalized.messages),
    tools: normalized.tools,
    responseFormat: normalized.responseFormat,
  });
}

export async function resolveRoute(
  request: Request,
  normalized: NormalizedRequest,
): Promise<{ route?: JevRoute; via: ResolveVia; fingerprint: string }> {
  const fingerprint = resolveFingerprint(normalized);
  const routes = await listRoutes();
  const headerSlug = header(request, "x-jev-slug") || slugFromModel(normalized.model);
  if (headerSlug) {
    const route = routes.find((item) => item.slug === headerSlug);
    return { route, via: header(request, "x-jev-slug") ? "header" : "model", fingerprint };
  }
  const hashed = routes.find((item) => item.fingerprint && item.fingerprint === fingerprint && item.status !== "disabled");
  return { route: hashed, via: hashed ? "fingerprint" : "none", fingerprint };
}

export async function dispatchChatProxy(request: Request, rawBody: unknown): Promise<ProxyResult> {
  const normalized = normalizeRequest(rawBody ?? extractRequestPayload(JSON.stringify(rawBody ?? {})));
  const mode = readProxyMode(request);
  const resolved = await resolveRoute(request, normalized);
  const typesafeKey = header(request, "x-typesafe-key") || bearer(request);
  const jevModel = header(request, "x-jev-model") || "jev-latest";

  if (resolved.route && resolved.route.status !== "disabled" && (mode !== "fallback" || !canFallback(request))) {
    if (resolved.route.fit === "generative" && resolved.route.status !== "active") {
      if (canFallback(request) && mode !== "jev-only") {
        return fallbackToLlm(request, normalized, resolved);
      }
    }
    return runJev(request, normalized, resolved, typesafeKey, jevModel);
  }

  if (mode === "jev-only") {
    throw new HttpError(409, resolved.route ? `路由 ${resolved.route.slug} 已停用` : `没有匹配的 Jev 路由。fingerprint=${resolved.fingerprint}`);
  }
  if (canFallback(request)) return fallbackToLlm(request, normalized, resolved);
  throw new HttpError(409, `没有匹配的 Jev 路由。fingerprint=${resolved.fingerprint}`);
}

async function runJev(
  request: Request,
  normalized: NormalizedRequest,
  resolved: { route?: JevRoute; via: ResolveVia; fingerprint: string },
  typesafeKey: string,
  jevModel: string,
): Promise<ProxyResult> {
  const route = resolved.route;
  if (!route) throw new HttpError(409, "没有匹配的 Jev 路由");
  const state = assembleState(normalized.messages, route.mapping);
  const evaluated = await evaluateSystemOne({
    apiKey: typesafeKey,
    model: jevModel,
    state,
    questions: route.questions,
    signal: request.signal,
  });
  return {
    via: resolved.via,
    fingerprint: resolved.fingerprint,
    route,
    engine: "jev",
    state,
    answers: evaluated.answers,
    completion: synthesizeChatCompletion({
      slug: route.slug,
      answers: evaluated.answers,
      usage: evaluated.usage,
      mode: route.synthesize,
      primary: route.primary,
    }),
  };
}

async function fallbackToLlm(
  request: Request,
  normalized: NormalizedRequest,
  resolved: { route?: JevRoute; via: ResolveVia; fingerprint: string },
): Promise<ProxyResult> {
  const result = await completeChat({
    baseUrl: header(request, "x-llm-base-url") || "https://api.openai.com/v1",
    apiKey: header(request, "x-llm-key") || bearer(request),
    model: normalized.model || header(request, "x-llm-model") || "gpt-4.1-mini",
    messages: normalized.messages.map((message) => ({
      role: message.role === "system" || message.role === "assistant" ? message.role : "user",
      content: message.content,
    })),
    signal: request.signal,
  });
  return {
    via: resolved.via,
    fingerprint: resolved.fingerprint,
    route: resolved.route,
    engine: "llm",
    completion: {
      id: `chatcmpl-llm-${resolved.fingerprint}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: normalized.model || "gpt-4.1-mini",
      choices: [{ index: 0, message: { role: "assistant", content: result.content }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: result.usage?.prompt_tokens ?? 0,
        completion_tokens: result.usage?.completion_tokens ?? 0,
        total_tokens: (result.usage?.prompt_tokens ?? 0) + (result.usage?.completion_tokens ?? 0),
      },
    },
  };
}

function canFallback(request: Request): boolean {
  return Boolean(header(request, "x-llm-base-url") || header(request, "x-llm-key"));
}

function bearer(request: Request): string {
  const value = header(request, "authorization");
  return value.replace(/^bearer\s+/i, "");
}
