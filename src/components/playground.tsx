"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  BookmarkIcon,
  CopyIcon,
  EraserIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  RouteIcon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useDefaultLayout } from "react-resizable-panels";
import { layoutStorage } from "@/lib/layout-storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FitBadge } from "@/components/answers";
import { ComparePane, type ChatRun } from "@/components/compare-pane";
import { QuestionEditor } from "@/components/question-editor";
import { SettingsBar } from "@/components/settings-bar";
import { StateEditor } from "@/components/state-editor";
import { WorkspacePanel } from "@/components/workspace-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { blankReplaceableState, pretty } from "@/lib/conversion";
import { samples } from "@/lib/samples";
import {
  defaultSettings,
  loadWorkbench,
  saveWorkbench,
  type QuestionPack,
  type Settings,
} from "@/lib/storage";
import {
  questionsSchema,
  stateSchema,
  type Conversion,
  type SystemOneResponse,
} from "@/lib/types";

export function Playground() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [source, setSource] = useState("");
  const [stateText, setStateText] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"convert" | "compare" | null>(null);
  const [response, setResponse] = useState<SystemOneResponse | null>(null);
  const [chat, setChat] = useState<ChatRun | null>(null);
  const [chatError, setChatError] = useState("");
  const [jevError, setJevError] = useState("");
  const [ranSignature, setRanSignature] = useState<string | null>(null);
  const [chatSourceRan, setChatSourceRan] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const runRef = useRef<() => void>(() => undefined);
  const wide = useMediaQuery("(min-width: 1100px)");

  useEffect(() => {
    const stored = loadWorkbench();
    if (stored) {
      setSettings(stored.settings);
      setPacks(stored.packs);
      setSource(stored.draft.source);
      setStateText(stored.draft.stateText);
      setQuestionsText(stored.draft.questionsText);
      setConversion(stored.draft.conversion);
      setPackTitle(stored.draft.conversion?.title ?? "");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveWorkbench({
      settings,
      packs,
      draft: { source, stateText, questionsText, conversion },
    });
  }, [ready, settings, packs, source, stateText, questionsText, conversion]);

  const stateParsed = useMemo(() => stateSchema.safeParse(parseJson(stateText)), [stateText]);
  const questionsParsed = useMemo(() => {
    const json = parseJson(questionsText);
    return json === undefined ? null : questionsSchema.safeParse(json);
  }, [questionsText]);

  const requestPreview = useMemo(() => {
    if (!stateParsed.success || !questionsParsed?.success) return "";
    return pretty({
      state: stateParsed.data,
      model: settings.typesafeModel || "jev-latest",
      questions: questionsParsed.data,
    });
  }, [stateParsed, questionsParsed, settings.typesafeModel]);

  const signature = `${stateText}\n---\n${questionsText}`;
  const stale = Boolean(response && ranSignature !== null && ranSignature !== signature);
  const chatStale = Boolean(chat && chatSourceRan !== null && chatSourceRan !== source);
  const hasBench = Boolean(questionsText.trim());
  const canChat = Boolean(source.trim());
  const canJev = Boolean(requestPreview);
  const canCompare = canChat || canJev;

  async function convert() {
    setBusy("convert");
    setError("");
    setStatus("正在把 chat completion 转成 Jev…");
    setResponse(null);
    try {
      const result = await postJson<{ conversion: Conversion; model?: string }>("/api/convert", {
        baseUrl: settings.llmBaseUrl,
        apiKey: settings.llmApiKey,
        model: settings.llmModel.trim(),
        source,
      });
      applyConversion(result.conversion);
      const usedModel = result.model?.trim() || settings.llmModel.trim();
      setStatus(`已用 ${usedModel} 转成 State 和 Questions。改完原请求可再转换，或直接运行对比。`);
      toast.success(`已用 ${usedModel} 转换成 Jev`);
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "转换失败");
    } finally {
      setBusy(null);
    }
  }

  function applyConversion(next: Conversion) {
    setConversion(next);
    setStateText(pretty(next.state));
    setQuestionsText(pretty(next.questions));
    setPackTitle(next.title);
    setResponse(null);
    setRanSignature(null);
    setRevision((value) => value + 1);
  }

  function loadSample(id: string) {
    const sample = samples.find((item) => item.id === id);
    if (!sample) return;
    setSource(sample.source);
    applyConversion(sample.preview);
    setResponse(null);
    setChat(null);
    setChatError("");
    setJevError("");
    setChatSourceRan(null);
    setError("");
    setStatus("已载入示例。可以直接运行对比，或先改 State / Questions。");
  }

  function blankState() {
    if (!stateParsed.success || !conversion) return;
    setStateText(pretty(blankReplaceableState(stateParsed.data, conversion.fields)));
    setRevision((value) => value + 1);
    setStatus("可替换字段已清空。问题保持不变。");
  }

  function savePack() {
    if (!questionsParsed?.success) {
      setError("先把 Questions 改成合法结构，再保存");
      return;
    }
    const title = packTitle.trim() || conversion?.title || "未命名问题组";
    const pack: QuestionPack = {
      id: crypto.randomUUID(),
      title,
      savedAt: new Date().toISOString(),
      summary: conversion?.summary ?? "",
      questions: questionsParsed.data,
      questionNotes: conversion?.questionNotes ?? [],
    };
    setPacks((current) => [pack, ...current.filter((item) => item.title !== title)]);
    setStatus(`已保存问题组「${title}」。之后可以只换 State。`);
    setError("");
    toast.success(`已保存模板「${title}」`);
  }

  function loadPack(pack: QuestionPack) {
    setQuestionsText(pretty(pack.questions));
    setPackTitle(pack.title);
    setConversion((current) =>
      current
        ? { ...current, title: pack.title, summary: pack.summary, questions: pack.questions, questionNotes: pack.questionNotes }
        : {
            title: pack.title,
            summary: pack.summary,
            fit: "judgment",
            warnings: [],
            state: stateParsed.success ? stateParsed.data : "",
            fields: [],
            questions: pack.questions,
            questionNotes: pack.questionNotes,
          },
    );
    setStatus(`已载入「${pack.title}」。State 没有改。`);
    setError("");
  }

  async function publishRoute() {
    if (!conversion || !questionsParsed?.success) {
      setError("先转换出可用的 Questions，再发布到代理");
      return;
    }
    try {
      const response = await fetch("/api/proxy/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slugify(packTitle || conversion.title),
          source,
          conversion: {
            ...conversion,
            questions: questionsParsed.data,
            title: packTitle.trim() || conversion.title,
          },
        }),
      });
      const payload = (await response.json()) as { route?: { slug: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || "发布失败");
      setStatus(`已发布代理路由 ${payload.route?.slug}。可到代理页用同一段请求试命中。`);
      setError("");
      toast.success(`已发布代理路由 ${payload.route?.slug}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发布失败");
    }
  }

  async function runCompare() {
    const runChat = canChat && Boolean(settings.llmModel.trim());
    const runJev = canJev && Boolean(settings.typesafeApiKey.trim());

    if (!canCompare) {
      setError("先载入原请求，或转换出 Questions。");
      return;
    }
    if (canChat && !settings.llmModel.trim()) {
      setSettingsOpen(true);
      setChatError("先填写转换模型名称，再跑传统 Chat。");
    }
    if (canJev && !settings.typesafeApiKey.trim()) {
      setSettingsOpen(true);
      setJevError("先填写 TypeSafe Key，再跑 Jev。");
    }
    if (!runChat && !runJev) {
      setError("先补齐至少一侧的模型设置，再运行对比。");
      return;
    }

    setBusy("compare");
    setError("");
    setChatError("");
    setJevError("");
    setStatus(runChat && runJev ? "正在同时跑 Chat 和 Jev…" : runChat ? "正在跑传统 Chat…" : "正在问 Jev…");

    const tasks: Promise<void>[] = [];
    if (runChat) {
      const snapshot = source;
      tasks.push(
        (async () => {
          const started = Date.now();
          try {
            const result = await postJson<ChatRun>("/api/chat", {
              baseUrl: settings.llmBaseUrl,
              apiKey: settings.llmApiKey,
              model: settings.llmModel.trim(),
              source,
            });
            setChat({ ...result, latencyMs: result.latencyMs ?? Date.now() - started });
            setChatSourceRan(snapshot);
          } catch (caught) {
            setChatError(caught instanceof Error ? caught.message : "Chat completion 失败");
          }
        })(),
      );
    }
    if (runJev && stateParsed.success && questionsParsed?.success) {
      const snapshot = `${stateText}\n---\n${questionsText}`;
      tasks.push(
        (async () => {
          try {
            const result = await postJson<SystemOneResponse>("/api/evaluate", {
              apiKey: settings.typesafeApiKey,
              model: settings.typesafeModel,
              state: stateParsed.data,
              questions: questionsParsed.data,
            });
            setResponse(result);
            setRanSignature(snapshot);
          } catch (caught) {
            setJevError(caught instanceof Error ? caught.message : "Jev 调用失败");
          }
        })(),
      );
    }

    await Promise.all(tasks);
    setBusy(null);
    setStatus("对比完成。左侧是生成文字，右侧是 Jev 概率。");
  }

  runRef.current = () => {
    void runCompare();
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const compareLabel = canChat && canJev ? "运行对比" : canChat ? "运行 Chat" : canJev ? "运行 Jev" : "运行对比";
  const panelIds = ["source", "state", "questions", "results"];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    storage: layoutStorage,
    id: `chat2jev.bench.${wide ? "h" : "v"}`,
    panelIds,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <SettingsBar settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} onChange={setSettings} />

      <ResizablePanelGroup
        key={wide ? "h" : "v"}
        id="chat2jev-bench"
        orientation={wide ? "horizontal" : "vertical"}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel
          id="source"
          key={sourceCollapsed ? "source-collapsed" : "source-open"}
          defaultSize={sourceCollapsed ? 52 : "22"}
          minSize={sourceCollapsed ? 52 : wide ? "14" : 140}
          maxSize={sourceCollapsed ? 52 : undefined}
          className="min-h-0 min-w-0"
        >
          {sourceCollapsed && wide ? (
            <button
              type="button"
              data-tone="source"
              className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10"
              aria-expanded={false}
              aria-label="展开原始 Chat 请求"
              onClick={() => setSourceCollapsed(false)}
            >
              <span className="tone-dot" aria-hidden="true" />
              <PanelLeftOpenIcon />
              <span className="[writing-mode:vertical-rl] text-xs">原请求</span>
            </button>
          ) : (
            <WorkspacePanel
              tone="source"
              title="原始 Chat 请求"
              description="发给传统模型的原文。转换成 Jev 后，换测试数据只改 State。"
              hideContent={sourceCollapsed}
              action={
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm" />}>
                      <MoreHorizontalIcon />
                      <span className="sr-only">加载示例</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-auto min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>加载示例</DropdownMenuLabel>
                        {samples.map((sample) => (
                          <DropdownMenuItem key={sample.id} onClick={() => loadSample(sample.id)}>
                            {sample.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-expanded={!sourceCollapsed}
                          aria-label={sourceCollapsed ? "展开原请求" : "收起原请求"}
                          onClick={() => setSourceCollapsed((open) => !open)}
                        />
                      }
                    >
                      {sourceCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
                    </TooltipTrigger>
                    <TooltipContent>{sourceCollapsed ? "展开原请求" : "收起原请求"}</TooltipContent>
                  </Tooltip>
                  <Button type="button" size="sm" disabled={busy !== null || !source.trim()} onClick={convert}>
                    {busy === "convert" ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                    {busy === "convert" ? "转换中…" : "转换成 Jev"}
                  </Button>
                </div>
              }
              contentClassName="gap-2"
            >
              <Textarea
                className="editor fill"
                value={source}
                spellCheck={false}
                placeholder='粘贴 {"model": "...", "messages": [...]} 或 curl 请求命令…'
                aria-label="原始请求"
                onChange={(event) => setSource(event.target.value)}
              />
            </WorkspacePanel>
          )}
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />

        <ResizablePanel id="state" defaultSize="20" minSize={wide ? "14" : 160} className="min-h-0 min-w-0">
          <WorkspacePanel
            tone="state"
            title="State"
            description="Jev 读到的事实。换数据只改这里。"
            action={
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!conversion || !stateParsed.success}
                      onClick={blankState}
                    />
                  }
                >
                  <EraserIcon data-icon="inline-start" />
                  清空
                </TooltipTrigger>
                <TooltipContent>清空可替换字段的值，保留字段结构</TooltipContent>
              </Tooltip>
            }
            contentClassName="gap-2"
          >
            {hasBench ? (
              <>
                {conversion ? <ConversionNotes conversion={conversion} /> : null}
                <StateEditor
                  text={stateText}
                  fields={conversion?.fields ?? []}
                  revision={revision}
                  onTextChange={setStateText}
                />
              </>
            ) : (
              <Empty className="min-h-0 flex-1 border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SparklesIcon />
                  </EmptyMedia>
                  <EmptyTitle>还没有 State</EmptyTitle>
                  <EmptyDescription>粘贴 Chat 请求后点「转换成 Jev」，或先载入示例。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </WorkspacePanel>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />
        <ResizablePanel id="questions" defaultSize="24" minSize={wide ? "16" : 160} className="min-h-0 min-w-0">
          <WorkspacePanel tone="questions" title="Questions" description="可复用的判断维度。" contentClassName="gap-2">
            {hasBench ? (
              <>
                <QuestionEditor
                  text={questionsText}
                  notes={conversion?.questionNotes ?? []}
                  onTextChange={setQuestionsText}
                />
                <div className="flex shrink-0 flex-col gap-2 border-t pt-2">
                  <div className="flex gap-2">
                    <Input
                      value={packTitle}
                      onChange={(event) => setPackTitle(event.target.value)}
                      aria-label="问题模板名称"
                      placeholder="模板名称，如：售后分诊标准版"
                    />
                    <Button type="button" variant="outline" onClick={savePack}>
                      <BookmarkIcon data-icon="inline-start" />
                      保存
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!requestPreview}
                            onClick={async () => {
                              await copyText(requestPreview);
                              setStatus("已复制 TypeSafe System One 请求 JSON。");
                              setError("");
                              toast.success("已复制 TypeSafe 请求 JSON");
                            }}
                          />
                        }
                      >
                        <CopyIcon data-icon="inline-start" />
                        复制 Jev 请求
                      </TooltipTrigger>
                      <TooltipContent>复制发往 TypeSafe /v1/systemone 的完整请求</TooltipContent>
                    </Tooltip>
                    <Button type="button" variant="outline" size="sm" disabled={!conversion} onClick={publishRoute}>
                      <RouteIcon data-icon="inline-start" />
                      发布代理
                    </Button>
                  </div>
                  {packs.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">模板：</span>
                      {packs.map((pack) => (
                        <span key={pack.id} className="inline-flex items-center overflow-hidden rounded-full border">
                          <Button type="button" variant="ghost" size="sm" onClick={() => loadPack(pack)}>
                            {pack.title}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title="删除此模板"
                            onClick={() => setPacks((current) => current.filter((item) => item.id !== pack.id))}
                          >
                            <XIcon />
                          </Button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <Empty className="min-h-0 flex-1 border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ScaleIcon />
                  </EmptyMedia>
                  <EmptyTitle>还没有 Questions</EmptyTitle>
                  <EmptyDescription>转换后会在这里列出可复用的判断维度，并可保存成模板。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </WorkspacePanel>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />

        <ResizablePanel id="results" defaultSize="34" minSize={wide ? "22" : 180} className="min-h-0 min-w-0">
          <WorkspacePanel
            tone="results"
            title="结果对比"
            description={hasBench ? "同一输入：Chat 生成文字，Jev 给出带概率的判断。" : "先转换或载入示例，再同时跑 Chat 和 Jev。"}
            contentClassName="min-h-0 px-0 py-0"
          >
            <ComparePane
              questionsText={questionsText}
              notes={conversion?.questionNotes ?? []}
              chat={chat}
              chatError={chatError}
              jev={response}
              jevError={jevError}
              stale={stale}
              chatStale={chatStale}
            />
          </WorkspacePanel>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="m-0 truncate text-sm text-primary-foreground/80">
            {error ? (
              <span className="text-warning-foreground">⚠️ {error}</span>
            ) : stale || chatStale ? (
              <span>输入已改动，当前显示的是上次对比结果</span>
            ) : (
              status || "原请求可收起 · 改完可再转换 · ⌘ Enter 跑对比"
            )}
          </p>
          <Kbd className="bg-primary-foreground/10 text-primary-foreground/80">⌘ Enter</Kbd>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() => setSourceCollapsed((open) => !open)}
          >
            {sourceCollapsed ? <PanelLeftOpenIcon data-icon="inline-start" /> : <PanelLeftCloseIcon data-icon="inline-start" />}
            {sourceCollapsed ? "展开原请求" : "收起原请求"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            disabled={busy !== null || !source.trim()}
            onClick={convert}
          >
            {busy === "convert" ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            {busy === "convert" ? "转换中…" : "转换成 Jev"}
          </Button>
          <Button type="button" variant="copper" disabled={busy !== null || !canCompare} onClick={runCompare}>
            {busy === "compare" ? <Spinner data-icon="inline-start" /> : stale || chatStale ? <RefreshCwIcon data-icon="inline-start" /> : <ScaleIcon data-icon="inline-start" />}
            {busy === "compare" ? "正在对比…" : stale || chatStale ? "重新对比" : compareLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConversionNotes({ conversion }: { conversion: Conversion }) {
  const [open, setOpen] = useState(false);
  const warnings = conversion.warnings;

  return (
    <div
      className={cn("flex flex-col", open && warnings.length > 0 ? "gap-1.5" : "gap-0")}
      data-open={open ? "true" : "false"}
      onPointerEnter={() => {
        if (warnings.length > 0) setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FitBadge fit={conversion.fit} />
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">{conversion.summary}</span>
        {warnings.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            data-tone="copper"
            className="cursor-help"
            aria-expanded={open}
            aria-label={`转换注意点 ${warnings.length} 条，悬停查看`}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
          >
            <AlertTriangleIcon data-icon="inline-start" />
            注意点 {warnings.length}
          </Button>
        ) : null}
      </div>
      {warnings.length > 0 ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <Alert data-tone="copper">
              <AlertTriangleIcon />
              <AlertTitle>转换注意点</AlertTitle>
              <AlertDescription>
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return payload as T;
}

function parseJson(text: string): unknown {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard can be unavailable in a locked-down browser. The request is still on screen.
  }
}

function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (ascii.length >= 2) return ascii;
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `route-${hash.toString(36)}`;
}
