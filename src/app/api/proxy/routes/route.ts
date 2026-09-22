import { jsonError } from "@/lib/http";
import { promptFingerprint, systemText } from "@/lib/proxy/slug";
import { listRoutes, upsertRoute } from "@/lib/proxy/store";
import { jevRouteSchema, routeFromConversion, stateMappingSchema } from "@/lib/proxy/types";
import { extractRequestPayload, normalizeRequest } from "@/lib/openai-request";
import { conversionSchema, formatZodError } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ routes: await listRoutes() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError(400, "需要 JSON 请求体");

  if (body.conversion) {
    const conversion = conversionSchema.safeParse(body.conversion);
    if (!conversion.success) return jsonError(400, formatZodError(conversion.error));
    const slug = typeof body.slug === "string" ? body.slug : "";
    if (!slug) return jsonError(400, "发布路由需要 slug");
    let fingerprint = typeof body.fingerprint === "string" ? body.fingerprint : undefined;
    if (!fingerprint && typeof body.source === "string" && body.source.trim()) {
      const normalized = normalizeRequest(extractRequestPayload(body.source));
      fingerprint = promptFingerprint({
        system: systemText(normalized.messages),
        tools: normalized.tools,
        responseFormat: normalized.responseFormat,
      });
    }
    const mapping = body.mapping ? stateMappingSchema.safeParse(body.mapping) : null;
    if (mapping && !mapping.success) return jsonError(400, formatZodError(mapping.error));
    const route = await upsertRoute(
      routeFromConversion({
        slug,
        conversion: conversion.data,
        fingerprint,
        mapping: mapping?.success ? mapping.data : undefined,
        synthesize:
          body.synthesize === "json" || body.synthesize === "choice_text" || body.synthesize === "tool_call"
            ? body.synthesize
            : undefined,
        primary: typeof body.primary === "string" ? body.primary : undefined,
      }),
    );
    return Response.json({ route });
  }

  const parsed = jevRouteSchema.safeParse({
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  return Response.json({ route: await upsertRoute(parsed.data) });
}
