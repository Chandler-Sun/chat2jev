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
  PlayIcon,
  RefreshCwIcon,
  RouteIcon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useDefaultLayout } from "react-resizable-panels";
import { layoutStorage } from "@/lib/layout-storage";
import { toast } from "sonner";
import { FitBadge } from "@/components/answers";
import { ComparePane, type ChatRun } from "@/components/compare-pane";
import { getLocale, useI18n } from "@/components/locale-provider";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Kbd } from "@/components/ui/kbd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientOnly } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { blankReplaceableState, pretty } from "@/lib/conversion";
import { findSampleId, sampleById, samplesFor } from "@/lib/samples";
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
import { translate, type MessageKey } from "@/lib/i18n";

export function Playground() {
  const { locale, t } = useI18n();
  const localeSamples = samplesFor(locale);
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
  const [busy, setBusy] = useState<"convert" | "compare" | "jev" | null>(null);
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

  useEffect(() => {
    if (!ready) return;
    const id = findSampleId(source, stateText, questionsText);
    if (!id) return;
    const localized = sampleById(locale, id);
    if (!localized) return;
    if (
      localized.source === source &&
      pretty(localized.preview.state) === stateText &&
      pretty(localized.preview.questions) === questionsText &&
      conversion?.title === localized.preview.title
    ) {
      return;
    }
    applySample(localized);
  }, [ready, locale, source, stateText, questionsText, conversion?.title]);

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
    setStatus(t("status.converting"));
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
      setStatus(t("status.converted", { model: usedModel }));
      toast.success(t("status.convertToast", { model: usedModel }));
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : t("status.convertFail"));
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
    const sample = sampleById(locale, id);
    if (!sample) return;
    applySample(sample);
    setStatus(t("status.sample"));
  }

  function applySample(sample: (typeof localeSamples)[number]) {
    setSource(sample.source);
    applyConversion(sample.preview);
    setResponse(null);
    setChat(null);
    setChatError("");
    setJevError("");
    setChatSourceRan(null);
    setError("");
  }

  function blankState() {
    if (!stateParsed.success || !conversion) return;
    setStateText(pretty(blankReplaceableState(stateParsed.data, conversion.fields)));
    setRevision((value) => value + 1);
    setStatus(t("status.blanked"));
  }

  function savePack() {
    if (!questionsParsed?.success) {
      setError(t("status.saveInvalid"));
      return;
    }
    const title = packTitle.trim() || conversion?.title || t("status.untitled");
    const pack: QuestionPack = {
      id: crypto.randomUUID(),
      title,
      savedAt: new Date().toISOString(),
      summary: conversion?.summary ?? "",
      questions: questionsParsed.data,
      questionNotes: conversion?.questionNotes ?? [],
    };
    setPacks((current) => [pack, ...current.filter((item) => item.title !== title)]);
    setStatus(t("status.saved", { title }));
    setError("");
    toast.success(t("status.savedToast", { title }));
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
    setStatus(t("status.packLoaded", { title: pack.title }));
    setError("");
  }

  async function publishRoute() {
    if (!conversion || !questionsParsed?.success) {
      setError(t("status.publishNeed"));
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
      if (!response.ok) throw new Error(payload.error || t("status.publishFail"));
      setStatus(t("status.published", { slug: payload.route?.slug ?? "" }));
      setError("");
      toast.success(t("status.publishedToast", { slug: payload.route?.slug ?? "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("status.publishFail"));
    }
  }

  async function fetchJev() {
    if (!stateParsed.success || !questionsParsed?.success) {
      throw new Error(t("status.needBench"));
    }
    const snapshot = `${stateText}\n---\n${questionsText}`;
    const result = await postJson<SystemOneResponse>("/api/evaluate", {
      apiKey: settings.typesafeApiKey,
      model: settings.typesafeModel,
      state: stateParsed.data,
      questions: questionsParsed.data,
    });
    setResponse(result);
    setRanSignature(snapshot);
  }

  async function runJev() {
    if (!canJev) {
      setError(t("status.needQuestions"));
      return;
    }
    if (!settings.typesafeApiKey.trim()) {
      setSettingsOpen(true);
      setJevError(t("status.needJevKey"));
      return;
    }

    setBusy("jev");
    setError("");
    setJevError("");
    setStatus(t("status.askingJev"));
    try {
      await fetchJev();
      setStatus(t("status.jevDone"));
      toast.success(t("status.jevToast"));
    } catch (caught) {
      setJevError(caught instanceof Error ? caught.message : t("status.jevFail"));
    } finally {
      setBusy(null);
    }
  }

  async function runCompare() {
    const runChat = canChat && Boolean(settings.llmModel.trim());
    const runJevSide = canJev && Boolean(settings.typesafeApiKey.trim());

    if (!canCompare) {
      setError(t("status.needInput"));
      return;
    }
    if (canChat && !settings.llmModel.trim()) {
      setSettingsOpen(true);
      setChatError(t("status.needChatModel"));
    }
    if (canJev && !settings.typesafeApiKey.trim()) {
      setSettingsOpen(true);
      setJevError(t("status.needJevKey"));
    }
    if (!runChat && !runJevSide) {
      setError(t("status.needSide"));
      return;
    }

    setBusy("compare");
    setError("");
    setChatError("");
    setJevError("");
    setStatus(runChat && runJevSide ? t("status.runningBoth") : runChat ? t("status.runningChat") : t("status.askingJev"));

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
            setChatError(caught instanceof Error ? caught.message : t("status.chatFail"));
          }
        })(),
      );
    }
    if (runJevSide) {
      tasks.push(
        (async () => {
          try {
            await fetchJev();
          } catch (caught) {
            setJevError(caught instanceof Error ? caught.message : t("status.jevFail"));
          }
        })(),
      );
    }

    await Promise.all(tasks);
    setBusy(null);
    setStatus(t("status.compared"));
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

  const compareLabel = canChat && canJev ? t("dock.compare") : canChat ? t("dock.chat") : t("dock.compare");
  const panelIds = ["source", "state", "questions", "results"];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    storage: layoutStorage,
    id: `chat2jev.bench.${wide ? "h" : "v"}`,
    panelIds,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <SettingsBar settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} onChange={setSettings} />

      <ClientOnly fallback={<div className="min-h-0 flex-1" />}>
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
              aria-label={t("source.expand")}
              onClick={() => setSourceCollapsed(false)}
            >
              <span className="tone-dot" aria-hidden="true" />
              <PanelLeftOpenIcon />
              <span className="[writing-mode:vertical-rl] text-xs">{t("source.rail")}</span>
            </button>
          ) : (
            <WorkspacePanel
              tone="source"
              title={t("source.title")}
              description={t("source.desc")}
              hideContent={sourceCollapsed}
              action={
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm" />}>
                      <MoreHorizontalIcon />
                      <span className="sr-only">{t("sample.load")}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-auto min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>{t("sample.load")}</DropdownMenuLabel>
                        {localeSamples.map((sample) => (
                          <DropdownMenuItem key={sample.id} onClick={() => loadSample(sample.id)}>
                            {t(`sample.${sample.id}` as MessageKey)}
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
                          aria-label={sourceCollapsed ? t("source.expand") : t("source.collapse")}
                          onClick={() => setSourceCollapsed((open) => !open)}
                        />
                      }
                    >
                      {sourceCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
                    </TooltipTrigger>
                    <TooltipContent>{sourceCollapsed ? t("source.expand") : t("source.collapse")}</TooltipContent>
                  </Tooltip>
                  <Button type="button" size="sm" disabled={busy !== null || !source.trim()} onClick={convert}>
                    {busy === "convert" ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                    {busy === "convert" ? t("source.converting") : t("source.convert")}
                  </Button>
                </div>
              }
              contentClassName="gap-2"
            >
              <Textarea
                className="editor fill"
                value={source}
                spellCheck={false}
                placeholder={t("source.placeholder")}
                aria-label={t("source.aria")}
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
            description={t("state.desc")}
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
                  {t("state.clear")}
                </TooltipTrigger>
                <TooltipContent>{t("state.clearHint")}</TooltipContent>
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
                  <EmptyTitle>{t("state.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("state.emptyDesc")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </WorkspacePanel>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />
        <ResizablePanel id="questions" defaultSize="24" minSize={wide ? "16" : 160} className="min-h-0 min-w-0">
          <WorkspacePanel tone="questions" title="Questions" description={t("questions.desc")} contentClassName="gap-2">
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
                      aria-label={t("questions.packName")}
                      placeholder={t("questions.packPlaceholder")}
                    />
                    <Button type="button" variant="outline" onClick={savePack}>
                      <BookmarkIcon data-icon="inline-start" />
                      {t("questions.save")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={busy !== null || !canJev} onClick={runJev}>
                      {busy === "jev" ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
                      {busy === "jev" ? t("questions.testing") : t("questions.testJev")}
                    </Button>
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
                              setStatus(t("status.copied"));
                              setError("");
                              toast.success(t("status.copiedToast"));
                            }}
                          />
                        }
                      >
                        <CopyIcon data-icon="inline-start" />
                        {t("questions.copy")}
                      </TooltipTrigger>
                      <TooltipContent>{t("questions.copyHint")}</TooltipContent>
                    </Tooltip>
                    <Button type="button" variant="outline" size="sm" disabled={!conversion} onClick={publishRoute}>
                      <RouteIcon data-icon="inline-start" />
                      {t("questions.publish")}
                    </Button>
                  </div>
                  {packs.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t("questions.packs")}</span>
                      {packs.map((pack) => (
                        <span key={pack.id} className="inline-flex items-center overflow-hidden rounded-full border">
                          <Button type="button" variant="ghost" size="sm" onClick={() => loadPack(pack)}>
                            {pack.title}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t("questions.deletePack")}
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
                  <EmptyTitle>{t("questions.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("questions.emptyDesc")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </WorkspacePanel>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />

        <ResizablePanel id="results" defaultSize="34" minSize={wide ? "22" : 180} className="min-h-0 min-w-0">
          <WorkspacePanel
            tone="results"
            title={t("results.title")}
            description={hasBench ? t("results.descReady") : t("results.descEmpty")}
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
      </ClientOnly>

      <div className="workbench-dock rounded-xl bg-primary px-3 py-2 text-primary-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="m-0 truncate text-sm text-primary-foreground/80">
            {error ? (
              <span className="text-warning-foreground">⚠️ {error}</span>
            ) : stale || chatStale ? (
              <span>{t("dock.stale")}</span>
            ) : (
              status || t("dock.hint")
            )}
          </p>
          <Kbd className="bg-primary-foreground/10 text-primary-foreground/80">⌘ Enter</Kbd>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() => setSourceCollapsed((open) => !open)}
          >
            {sourceCollapsed ? <PanelLeftOpenIcon data-icon="inline-start" /> : <PanelLeftCloseIcon data-icon="inline-start" />}
            {sourceCollapsed ? t("source.expand") : t("source.collapse")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            disabled={busy !== null || !source.trim()}
            onClick={convert}
          >
            {busy === "convert" ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            {busy === "convert" ? t("source.converting") : t("source.convert")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            disabled={busy !== null || !canJev}
            onClick={runJev}
          >
            {busy === "jev" ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
            {busy === "jev" ? t("questions.testing") : t("questions.testJev")}
          </Button>
          <Button type="button" variant="copper" disabled={busy !== null || !canCompare} onClick={runCompare}>
            {busy === "compare" ? <Spinner data-icon="inline-start" /> : stale || chatStale ? <RefreshCwIcon data-icon="inline-start" /> : <ScaleIcon data-icon="inline-start" />}
            {busy === "compare" ? t("dock.comparing") : stale || chatStale ? t("dock.recompare") : compareLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConversionNotes({ conversion }: { conversion: Conversion }) {
  const { t } = useI18n();
  const warnings = conversion.warnings;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0">
        <FitBadge fit={conversion.fit} />
      </span>
      <HoverCard>
        <HoverCardTrigger
          render={<span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground" />}
        >
          {conversion.summary}
        </HoverCardTrigger>
        <HoverCardContent align="start" side="bottom" className="w-80 max-w-[min(22rem,calc(100vw-1.5rem))]">
          <p className="text-sm leading-6">{conversion.summary}</p>
        </HoverCardContent>
      </HoverCard>
      {warnings.length > 0 ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="xs"
                data-tone="copper"
                className="shrink-0"
                aria-label={t("notes.aria", { count: warnings.length })}
              />
            }
          >
            <AlertTriangleIcon data-icon="inline-start" />
            {t("notes.chip", { count: warnings.length })}
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" sideOffset={8} className="w-80 max-w-[min(22rem,calc(100vw-1.5rem))]">
            <Alert data-tone="copper" className="border-0 bg-transparent p-0 shadow-none">
              <AlertTriangleIcon />
              <AlertTitle>{t("notes.title")}</AlertTitle>
              <AlertDescription>
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </AlertDescription>
            </Alert>
          </PopoverContent>
        </Popover>
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
        : translate(getLocale(), "status.requestFail", { status: response.status });
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
