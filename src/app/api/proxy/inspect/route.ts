import { dispatchChatProxy, resolveRoute } from "@/lib/proxy/dispatch";
import { assembleState } from "@/lib/proxy/state-map";
import { extractRequestPayload, normalizeRequest } from "@/lib/openai-request";
import { HttpError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { source?: string; payload?: unknown; run?: boolean };
    const payload = body.payload ?? extractRequestPayload(body.source ?? "");
    const normalized = normalizeRequest(payload);
    const resolved = await resolveRoute(request, normalized);
    const state = resolved.route ? assembleState(normalized.messages, resolved.route.mapping) : undefined;
    if (!body.run) {
      return Response.json({
        via: resolved.via,
        fingerprint: resolved.fingerprint,
        route: resolved.route ?? null,
        state: state ?? null,
        engine: resolved.route && resolved.route.status !== "disabled" ? "jev" : "none",
      });
    }
    const result = await dispatchChatProxy(request, payload);
    return Response.json({
      via: result.via,
      fingerprint: result.fingerprint,
      route: result.route ?? null,
      state: result.state ?? state ?? null,
      answers: result.answers ?? null,
      engine: result.engine,
      completion: result.completion,
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    const message = error instanceof Error ? error.message : "预检失败";
    return jsonError(502, message);
  }
}
