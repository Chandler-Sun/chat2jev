"use client";

import { useEffect, useMemo, useState } from "react";
import { ScanSearchIcon, WaypointsIcon } from "lucide-react";
import { useDefaultLayout } from "react-resizable-panels";
import { layoutStorage } from "@/lib/layout-storage";
import { SettingsBar } from "@/components/settings-bar";
import { WorkspacePanel } from "@/components/workspace-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ClientOnly } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { pretty } from "@/lib/conversion";
import { samples } from "@/lib/samples";
import { defaultSettings, loadWorkbench, saveWorkbench, type Settings } from "@/lib/storage";
import type { JevRoute } from "@/lib/proxy/types";

type InspectResult = {
  via: string;
  fingerprint: string;
  route: JevRoute | null;
  state: unknown;
  answers?: Record<string, unknown> | null;
  engine: string;
  completion?: unknown;
  error?: string;
};

export function ProxyLab({ initialRoutes = [] }: { initialRoutes?: JevRoute[] }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [source, setSource] = useState<string>(samples[0].source);
  const [slug, setSlug] = useState("");
  const [mode, setMode] = useState<"auto" | "jev-only" | "fallback">("auto");
  const [routes, setRoutes] = useState<JevRoute[]>(initialRoutes);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("粘贴一段 chat completions 请求，看它会不会命中已登记的 Jev 路由。");
  const [busy, setBusy] = useState<"inspect" | "run" | null>(null);

  useEffect(() => {
    const stored = loadWorkbench();
    if (stored) setSettings(stored.settings);
    setReady(true);
    void refreshRoutes().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "载入路由表失败");
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const stored = loadWorkbench();
    saveWorkbench({
      settings,
      packs: stored?.packs ?? [],
      draft: stored?.draft ?? { source: "", stateText: "", questionsText: "", conversion: null },
    });
  }, [ready, settings]);

  const endpoint = useMemo(() => {
    if (typeof window === "undefined") return "/api/v1/chat/completions";
    return `${window.location.origin}/api/v1/chat/completions`;
  }, []);
  const wide = useMediaQuery("(min-width: 1100px)");
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    storage: layoutStorage,
    id: `chat2jev.proxy.${wide ? "h" : "v"}`,
    panelIds: ["request", "routes", "inspect"],
  });

  async function refreshRoutes() {
    const response = await fetch("/api/proxy/routes");
    const payload = (await response.json()) as { routes?: JevRoute[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "载入路由表失败");
    setRoutes(payload.routes ?? []);
  }

  async function preview(run: boolean) {
    setBusy(run ? "run" : "inspect");
    setError("");
    try {
      await refreshRoutes();
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-jev-mode": mode,
      };
      if (slug.trim()) headers["x-jev-slug"] = slug.trim();
      if (settings.typesafeApiKey.trim()) headers["x-typesafe-key"] = settings.typesafeApiKey.trim();
      if (settings.typesafeModel.trim()) headers["x-jev-model"] = settings.typesafeModel.trim();
      if (mode === "fallback") {
        headers["x-llm-base-url"] = settings.llmBaseUrl;
        headers["x-llm-key"] = settings.llmApiKey;
      }
      const response = await fetch("/api/proxy/inspect", {
        method: "POST",
        headers,
        body: JSON.stringify({ source, run }),
      });
      const payload = (await response.json()) as InspectResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || `预检失败（${response.status}）`);
      setInspect(payload);
      setStatus(
        payload.route
          ? `命中 ${payload.route.slug}（${payload.via}）· 引擎 ${payload.engine}`
          : `未命中。fingerprint ${payload.fingerprint}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "预检失败");
    } finally {
      setBusy(null);
    }
  }

  async function setRouteStatus(target: JevRoute, statusValue: JevRoute["status"]) {
    await fetch(`/api/proxy/routes/${target.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: statusValue }),
    });
    await refreshRoutes();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <SettingsBar settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} onChange={setSettings} />

      <ClientOnly fallback={<div className="min-h-0 flex-1" />}>
      <ResizablePanelGroup
        id="chat2jev-proxy"
        orientation={wide ? "horizontal" : "vertical"}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="request" defaultSize="34" minSize="18" className="min-h-0 min-w-0">
          <WorkspacePanel
            tone="source"
            title="代理入口"
            description={
              <>
                Base URL 填 <code>{endpoint.replace(/\/v1\/chat\/completions$/, "")}</code>
              </>
            }
            action={
              <div className="flex flex-wrap justify-end gap-1.5">
                {samples.map((sample) => (
                  <Button key={sample.id} type="button" variant="outline" size="sm" onClick={() => setSource(sample.source)}>
                    {sample.label}
                  </Button>
                ))}
              </div>
            }
            contentClassName="gap-2"
          >
            <FieldGroup className="shrink-0">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Field>
                  <FieldLabel htmlFor="proxy-slug">强制 slug</FieldLabel>
                  <Input id="proxy-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="ticket-triage" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="proxy-mode">未命中时</FieldLabel>
                  <NativeSelect
                    id="proxy-mode"
                    className="w-full"
                    value={mode}
                    onChange={(event) => setMode(event.target.value as typeof mode)}
                  >
                    <NativeSelectOption value="auto">只走已登记路由</NativeSelectOption>
                    <NativeSelectOption value="jev-only">必须走 Jev，否则报错</NativeSelectOption>
                    <NativeSelectOption value="fallback">未命中则回源常规模型</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
            </FieldGroup>
            <Textarea
              className="editor fill"
              value={source}
              spellCheck={false}
              aria-label="Chat Completions 请求"
              onChange={(event) => setSource(event.target.value)}
            />
          </WorkspacePanel>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />
        <ResizablePanel id="routes" defaultSize="28" minSize="16" className="min-h-0 min-w-0">
          <WorkspacePanel tone="routes" title="已登记路由" description="显式 slug 优先，其次用 prompt 指纹命中。">
            <div className="j-list">
              {routes.map((route) => (
                <article className="j-row" key={route.slug} data-open="false">
                  <div className="j-copy">
                    <strong className="j-id">{route.slug}</strong>
                    <span className="j-instruction">
                      {route.title} · {route.fit} · fingerprint {route.fingerprint ?? "未绑定"}
                      {route.builtin ? " · 内置" : ""}
                    </span>
                  </div>
                  <div className="j-side">
                    <Badge
                      variant="outline"
                      data-tone={route.status === "active" ? "moss" : route.status === "shadow" ? "ochre" : undefined}
                    >
                      {route.status}
                    </Badge>
                    <span className="j-meta">{Object.keys(route.questions).length} questions</span>
                    <ButtonGroup className="mt-2">
                      {(["active", "shadow", "disabled"] as const).map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={route.status === value}
                          onClick={() => setRouteStatus(route, value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </div>
                </article>
              ))}
            </div>
          </WorkspacePanel>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />
        <ResizablePanel id="inspect" defaultSize="38" minSize="20" className="min-h-0 min-w-0">
          <WorkspacePanel
            tone="inspect"
            title="识别与结果"
            description={inspect ? `${inspect.engine} · ${inspect.via} · ${inspect.fingerprint}` : "还没有预检"}
            contentClassName="gap-2"
          >
            {inspect ? (
              <>
                <pre className="editor short min-h-0 flex-1 overflow-auto rounded-lg p-3">
                  {pretty({
                    engine: inspect.engine,
                    via: inspect.via,
                    slug: inspect.route?.slug ?? null,
                    fingerprint: inspect.fingerprint,
                    state: inspect.state,
                  })}
                </pre>
                {inspect.answers ? <pre className="editor short min-h-0 flex-1 overflow-auto rounded-lg p-3">{pretty(inspect.answers)}</pre> : null}
                {inspect.completion ? <pre className="editor short min-h-0 flex-1 overflow-auto rounded-lg p-3">{pretty(inspect.completion)}</pre> : null}
              </>
            ) : (
              <Empty className="min-h-0 flex-1 border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScanSearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>还没有预检</EmptyTitle>
                  <EmptyDescription>先识别。命中后会看到拼好的 State；真实跑一遍才会出现 Jev 答案和还原后的 OpenAI 响应。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </WorkspacePanel>
        </ResizablePanel>
      </ResizablePanelGroup>
      </ClientOnly>

      <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
        <p className="m-0 min-w-0 flex-1 truncate text-sm text-primary-foreground/80">
          {error ? <span className="text-warning-foreground">⚠️ {error}</span> : status}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            disabled={busy !== null}
            onClick={() => preview(false)}
          >
            {busy === "inspect" ? <Spinner data-icon="inline-start" /> : <ScanSearchIcon data-icon="inline-start" />}
            {busy === "inspect" ? "识别中…" : "只识别"}
          </Button>
          <Button type="button" variant="copper" disabled={busy !== null} onClick={() => preview(true)}>
            {busy === "run" ? <Spinner data-icon="inline-start" /> : <WaypointsIcon data-icon="inline-start" />}
            {busy === "run" ? "评估中…" : "按代理真实跑一遍"}
          </Button>
        </div>
      </div>
    </div>
  );
}
