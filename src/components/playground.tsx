"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  BookmarkIcon,
  ChevronDownIcon,
  CopyIcon,
  EraserIcon,
  RefreshCwIcon,
  RouteIcon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { FitBadge } from "@/components/answers";
import { ComparePane, type ChatRun } from "@/components/compare-pane";
import { QuestionEditor } from "@/components/question-editor";
import { SettingsBar } from "@/components/settings-bar";
import { StateEditor } from "@/components/state-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [sourceOpen, setSourceOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<() => void>(() => undefined);

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
      if (stored.draft.conversion || stored.draft.questionsText) setSourceOpen(false);
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
      const result = await postJson<{ conversion: Conversion }>("/api/convert", {
        baseUrl: settings.llmBaseUrl,
        apiKey: settings.llmApiKey,
        model: settings.llmModel,
        source,
      });
      applyConversion(result.conversion);
      setSourceOpen(false);
      setStatus("已转成 State 和 Questions。运行对比可同时看 Chat 和 Jev。");
      toast.success("已转换成 Jev Questions 和 State");
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
    setSourceOpen(false);
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
              model: settings.llmModel,
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
    resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <div className="flex flex-col gap-3.5">
      <p className="mb-0.5 max-w-[760px] text-muted-foreground">
        <strong className="font-semibold text-foreground">Chat2Jev</strong> 对照同一段请求：左边是传统 chat completion 的生成结果，右边是 Jev 的结构化判断。先转换出{" "}
        <strong className="font-semibold text-foreground">State</strong> 和 <strong className="font-semibold text-foreground">Questions</strong>，再一起跑。
      </p>
      <SettingsBar settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} onChange={setSettings} />

      <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CollapsibleTrigger render={<button type="button" className="flex flex-col items-start gap-0.5 text-left" />}>
              <CardTitle className="flex items-center gap-1.5">
                原始 Chat 请求
                <ChevronDownIcon className={sourceOpen ? "rotate-180" : undefined} />
              </CardTitle>
              <CardDescription>
                {sourceOpen ? "收起原请求" : source.trim() ? "已载入原请求 · 点击可重新转换" : "导入 OpenAI 兼容请求或 curl"}
              </CardDescription>
            </CollapsibleTrigger>
            <CardAction className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">示例：</span>
              {samples.map((sample) => (
                <Button key={sample.id} type="button" variant="outline" size="sm" onClick={() => loadSample(sample.id)}>
                  {sample.label}
                </Button>
              ))}
            </CardAction>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="flex flex-col gap-3 pb-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">这段请求会原样发给传统模型；转换成 Jev 后，换测试数据只改 State。</p>
                <Button type="button" disabled={busy !== null || !source.trim()} onClick={convert}>
                  {busy === "convert" ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                  {busy === "convert" ? "正在转换…" : "转换成 Jev"}
                </Button>
              </div>
              <Textarea
                className="editor source-editor min-h-36"
                value={source}
                spellCheck={false}
                placeholder='粘贴 {"model": "...", "messages": [...]} 或 curl 请求命令…'
                aria-label="原始请求"
                onChange={(event) => setSource(event.target.value)}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {hasBench || canChat ? (
        hasBench ? (
        <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(240px,300px)_minmax(260px,0.9fr)_minmax(360px,1.35fr)]">
          <Card size="sm" className="min-h-[420px] overflow-auto pb-8 lg:h-[calc(100vh-360px)] lg:max-h-[calc(100vh-360px)]">
            <CardHeader>
              <CardTitle>State</CardTitle>
              <CardDescription>Jev 读到的事实。换数据只改这里。</CardDescription>
              <CardAction>
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
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {conversion ? (
                <div className="flex flex-wrap items-center gap-2">
                  <FitBadge fit={conversion.fit} />
                  <span className="text-sm text-muted-foreground">{conversion.summary}</span>
                </div>
              ) : null}
              {conversion && conversion.warnings.length > 0 ? (
                <Alert>
                  <AlertTriangleIcon />
                  <AlertTitle>转换注意点 ({conversion.warnings.length})</AlertTitle>
                  <AlertDescription>
                    {conversion.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : null}
              <StateEditor
                text={stateText}
                fields={conversion?.fields ?? []}
                revision={revision}
                onTextChange={setStateText}
              />
            </CardContent>
          </Card>

          <Card size="sm" className="min-h-[420px] overflow-auto pb-8 lg:h-[calc(100vh-360px)] lg:max-h-[calc(100vh-360px)]">
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>可复用的判断维度，对应 TypeSafe playground 中间栏。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <QuestionEditor
                text={questionsText}
                notes={conversion?.questionNotes ?? []}
                onTextChange={setQuestionsText}
              />
              <div className="flex flex-col gap-2 border-t pt-3">
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
            </CardContent>
          </Card>

          <Card
            size="sm"
            className="min-h-[420px] overflow-auto pb-8 lg:h-[calc(100vh-360px)] lg:max-h-[calc(100vh-360px)]"
            ref={resultsRef}
          >
            <CardHeader>
              <CardTitle>结果对比</CardTitle>
              <CardDescription>同一输入：Chat 生成文字，Jev 给出带概率的判断。</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
        ) : (
          <Card size="sm">
            <CardHeader>
              <CardTitle>结果对比</CardTitle>
              <CardDescription>先跑传统 Chat；转换成 Jev 后，右侧会出现结构化判断。</CardDescription>
            </CardHeader>
            <CardContent>
              <ComparePane
                questionsText=""
                notes={[]}
                chat={chat}
                chatError={chatError}
                jev={null}
                jevError=""
                stale={false}
                chatStale={chatStale}
              />
            </CardContent>
          </Card>
        )
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScaleIcon />
            </EmptyMedia>
            <EmptyTitle>还没有可对比的问题</EmptyTitle>
            <EmptyDescription>载入示例或转换一段 chat completion。然后同时跑传统模型和 Jev。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <p className="m-0 truncate text-sm text-primary-foreground/80">
            {error ? (
              <span className="text-warning-foreground">⚠️ {error}</span>
            ) : stale || chatStale ? (
              <span>输入已改动，当前显示的是上次对比结果</span>
            ) : (
              status || "⌘ Enter 同时跑 Chat 和 Jev"
            )}
          </p>
          <Kbd className="bg-primary-foreground/10 text-primary-foreground/80">⌘ Enter</Kbd>
        </div>
        <Button type="button" variant="copper" disabled={busy !== null || !canCompare} onClick={runCompare}>
          {busy === "compare" ? <Spinner data-icon="inline-start" /> : stale || chatStale ? <RefreshCwIcon data-icon="inline-start" /> : <ScaleIcon data-icon="inline-start" />}
          {busy === "compare" ? "正在对比…" : stale || chatStale ? "重新对比" : compareLabel}
        </Button>
      </div>
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
