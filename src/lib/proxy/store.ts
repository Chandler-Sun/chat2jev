import { seedRoutes } from "./seeds";
import { jevRouteSchema, type JevRoute } from "./types";

const KV_KEY = "custom-routes";
const DATA_FILE = "jev-routes.json";

type RouteKv = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

let writeLock: Promise<void> = Promise.resolve();
let memoryCustom: JevRoute[] | null = null;

function mergeRoutes(custom: JevRoute[]): JevRoute[] {
  const map = new Map<string, JevRoute>();
  for (const route of seedRoutes) map.set(route.slug, route);
  for (const route of custom) map.set(route.slug, { ...route, builtin: false });
  return [...map.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function parseRoutes(raw: string | null | undefined): JevRoute[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => jevRouteSchema.safeParse(item))
      .filter((item) => item.success)
      .map((item) => item.data);
  } catch {
    return [];
  }
}

function isCloudflareWorkerRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Cloudflare-Workers")
  );
}

async function getRouteKv(): Promise<RouteKv | null> {
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { JEV_ROUTES?: RouteKv } | undefined)?.JEV_ROUTES;
    if (kv && typeof kv.get === "function" && typeof kv.put === "function") {
      return kv;
    }
  } catch {
    // next dev / tests / missing Worker bindings
  }
  return null;
}

async function readFromFile(): Promise<JevRoute[] | null> {
  if (isCloudflareWorkerRuntime()) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const raw = await readFile(path.join(process.cwd(), "data", DATA_FILE), "utf8");
    return parseRoutes(raw);
  } catch {
    return memoryCustom;
  }
}

async function writeToFile(routes: JevRoute[]): Promise<boolean> {
  if (isCloudflareWorkerRuntime()) return false;
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, DATA_FILE), `${JSON.stringify(routes, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function readCustom(): Promise<JevRoute[]> {
  const kv = await getRouteKv();
  if (kv) return parseRoutes(await kv.get(KV_KEY, "text"));
  const fromFile = await readFromFile();
  if (fromFile) return fromFile;
  return memoryCustom ?? [];
}

async function writeCustom(routes: JevRoute[]) {
  memoryCustom = routes;
  const kv = await getRouteKv();
  if (kv) {
    await kv.put(KV_KEY, JSON.stringify(routes));
    return;
  }
  await writeToFile(routes);
}

export async function listRoutes(): Promise<JevRoute[]> {
  return mergeRoutes(await readCustom());
}

export async function getRoute(slug: string): Promise<JevRoute | undefined> {
  return (await listRoutes()).find((route) => route.slug === slug);
}

export async function upsertRoute(route: JevRoute): Promise<JevRoute> {
  const parsed = jevRouteSchema.parse({
    ...route,
    builtin: false,
    updatedAt: new Date().toISOString(),
  });
  await enqueue(async () => {
    const custom = (await readCustom()).filter((item) => item.slug !== parsed.slug);
    custom.push(parsed);
    await writeCustom(custom);
  });
  return parsed;
}

export async function deleteRoute(slug: string): Promise<boolean> {
  if (seedRoutes.some((route) => route.slug === slug)) return false;
  let removed = false;
  await enqueue(async () => {
    const custom = await readCustom();
    const next = custom.filter((item) => item.slug !== slug);
    removed = next.length !== custom.length;
    if (removed) await writeCustom(next);
  });
  return removed;
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = writeLock.then(task, task);
  writeLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
