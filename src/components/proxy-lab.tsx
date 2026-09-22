"use client";

import { useEffect, useMemo, useState } from "react";
import { ScanSearchIcon, WaypointsIcon } from "lucide-react";
import { SettingsBar } from "@/components/settings-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="flex flex-col gap-3.5">
      <p className="mb-0.5 max-w-[720px] text-muted-foreground">
        把 OpenAI 兼容的 <strong className="font-semibold text-foreground">/v1/chat/completions</strong> 接到这个代理。命中已登记 slug 或 prompt
        指纹后，自动拼 State、走 Jev，再还原成标准 Chat Completion。
      </p>
      <SettingsBar settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} onChange={setSettings} />

      <Card size="sm">
        <CardHeader>
          <CardTitle>代理入口</CardTitle>
          <CardDescription>
            Base URL 填 <code>{endpoint.replace(/\/v1\/chat\/completions$/, "")}</code>，或直接 POST <code>{endpoint}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FieldGroup>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
              <Field>
                <FieldLabel htmlFor="proxy-slug">强制 slug（可选，对应 x-jev-slug 或 model: jev:slug）</FieldLabel>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">示例请求：</span>
            {samples.map((sample) => (
              <Button key={sample.id} type="button" variant="outline" size="sm" onClick={() => setSource(sample.source)}>
                {sample.label}
              </Button>
            ))}
          </div>
          <Textarea
            className="editor min-h-45"
            value={source}
            spellCheck={false}
            aria-label="Chat Completions 请求"
            onChange={(event) => setSource(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => preview(false)}>
              {busy === "inspect" ? <Spinner data-icon="inline-start" /> : <ScanSearchIcon data-icon="inline-start" />}
              {busy === "inspect" ? "识别中…" : "只识别，不调用"}
            </Button>
            <Button type="button" variant="copper" disabled={busy !== null} onClick={() => preview(true)}>
              {busy === "run" ? <Spinner data-icon="inline-start" /> : <WaypointsIcon data-icon="inline-start" />}
              {busy === "run" ? "评估中…" : "按代理真实跑一遍"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-3.5 md:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <Card size="sm" className="min-h-[480px] overflow-auto pb-8 md:h-[calc(100vh-410px)] md:max-h-[calc(100vh-410px)]">
          <CardHeader>
            <CardTitle>已登记路由</CardTitle>
            <CardDescription>显式 slug 优先，其次用 system prompt 指纹自动命中。</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <Badge variant={route.status === "active" ? "secondary" : "outline"}>{route.status}</Badge>
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
          </CardContent>
        </Card>

        <Card size="sm" className="min-h-[480px] overflow-auto pb-8 md:h-[calc(100vh-410px)] md:max-h-[calc(100vh-410px)]">
          <CardHeader>
            <CardTitle>识别与结果</CardTitle>
            <CardDescription>{inspect ? `${inspect.engine} · ${inspect.via} · ${inspect.fingerprint}` : "还没有预检"}</CardDescription>
          </CardHeader>
          <CardContent>
            {inspect ? (
              <div className="flex flex-col gap-3">
                <pre className="editor short min-h-30 overflow-auto rounded-lg p-3">
                  {pretty({
                    engine: inspect.engine,
                    via: inspect.via,
                    slug: inspect.route?.slug ?? null,
                    fingerprint: inspect.fingerprint,
                    state: inspect.state,
                  })}
                </pre>
                {inspect.answers ? <pre className="editor short min-h-40 overflow-auto rounded-lg p-3">{pretty(inspect.answers)}</pre> : null}
                {inspect.completion ? <pre className="editor short min-h-40 overflow-auto rounded-lg p-3">{pretty(inspect.completion)}</pre> : null}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScanSearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>还没有预检</EmptyTitle>
                  <EmptyDescription>先识别。命中后会看到拼好的 State；真实跑一遍才会出现 Jev 答案和还原后的 OpenAI 响应。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">
        <p className="m-0 min-w-0 flex-1 truncate text-sm text-primary-foreground/80">
          {error ? <span className="text-warning-foreground">⚠️ {error}</span> : status}
        </p>
        <Button type="button" variant="copper" disabled={busy !== null} onClick={() => preview(true)}>
          {busy === "run" ? <Spinner data-icon="inline-start" /> : <WaypointsIcon data-icon="inline-start" />}
          按代理真实跑一遍
        </Button>
      </div>
    </div>
  );
}
