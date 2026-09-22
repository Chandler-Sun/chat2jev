import { jsonError } from "@/lib/http";
import { deleteRoute, getRoute, upsertRoute } from "@/lib/proxy/store";
import { jevRouteSchema } from "@/lib/proxy/types";
import { formatZodError } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const route = await getRoute(slug);
  if (!route) return jsonError(404, `没有这条路由：${slug}`);
  return Response.json({ route });
}

export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const current = await getRoute(slug);
  if (!current) return jsonError(404, `没有这条路由：${slug}`);
  const patch = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!patch) return jsonError(400, "需要 JSON 请求体");
  const parsed = jevRouteSchema.safeParse({
    ...current,
    ...patch,
    slug,
    updatedAt: new Date().toISOString(),
  });
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  return Response.json({ route: await upsertRoute(parsed.data) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params;
  const removed = await deleteRoute(slug);
  if (!removed) return jsonError(400, "内置路由不能删，只能改状态");
  return Response.json({ ok: true });
}
