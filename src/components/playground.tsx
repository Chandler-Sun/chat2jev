"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FitBadge } from "@/components/answers";
import { QuestionEditor } from "@/components/question-editor";
import { SettingsBar } from "@/components/settings-bar";
import { StateEditor } from "@/components/state-editor";
import { blankReplaceableState, pretty } from "@/lib/conversion";
import { samples } from "@/lib/samples";
import {
  defaultSettings,
  emptyDraft,
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
  const [busy, setBusy] = useState<"convert" | "run" | null>(null);
  const [response, setResponse] = useState<SystemOneResponse | null>(null);
  const [ranSignature, setRanSignature] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState("");
  const [sourceOpen, setSourceOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
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
  const hasBench = Boolean(questionsText.trim());

  async function convert() {
    setBusy("convert");
    setError("");
    setStatus("正在让常规模型拆分…");
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
      setStatus("问题可以留下来复用。换一份 State 再运行。");
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "拆分失败");
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
    setError("");
    setStatus("这是一份本地示例，还没有调用模型。可以直接改 State，或拿原始请求去拆分。");
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

  async function run() {
    if (!settings.typesafeApiKey.trim()) {
      setSettingsOpen(true);
      setError("先填写 TypeSafe Key，再运行。");
      setStatus("");
      return;
    }
    if (!stateParsed.success || !questionsParsed?.success) {
      setError("State 或 Questions 还不是合法 JSON");
      setStatus("");
      return;
    }
    const snapshot = `${stateText}\n---\n${questionsText}`;
    setBusy("run");
    setError("");
    setStatus("正在问 Jev…");
    try {
      const result = await postJson<SystemOneResponse>("/api/evaluate", {
        apiKey: settings.typesafeApiKey,
        model: settings.typesafeModel,
        state: stateParsed.data,
        questions: questionsParsed.data,
      });
      setResponse(result);
      setRanSignature(snapshot);
      setStatus(result.model ? `已返回 · ${result.model}` : "已返回");
      resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "调用失败");
    } finally {
      setBusy(null);
    }
  }

  runRef.current = () => {
    void run();
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

  return (
    <div className="playground">
      <p className="lede">
        先拆开请求，再换 <strong>State</strong> 反复运行。结果紧挨着每个问题，不用滚到页面底部。
      </p>
      <SettingsBar settings={settings} open={settingsOpen} onOpenChange={setSettingsOpen} onChange={setSettings} />

      <section className="drawer">
        <div className="drawer-head">
          <button type="button" className="drawer-toggle" aria-expanded={sourceOpen} onClick={() => setSourceOpen((value) => !value)}>
            <strong>原始请求</strong>
            <em>{sourceOpen ? "收起" : source.trim() ? "已载入，点开可改" : "粘贴 chat completions 或 curl"}</em>
          </button>
          <div className="actions">
            {samples.map((sample) => (
              <button key={sample.id} type="button" className="btn" onClick={() => loadSample(sample.id)}>
                {sample.label}
              </button>
            ))}
          </div>
        </div>
        {sourceOpen ? (
          <div className="drawer-body">
            <div className="panel-head">
              <p>拆分只用这一次。之后测试时只改 State。</p>
              <button type="button" className="btn btn-primary" disabled={busy !== null || !source.trim()} onClick={convert}>
                {busy === "convert" ? "拆分中…" : "拆分请求"}
              </button>
            </div>
            <textarea
              className="editor source-editor"
              value={source}
              spellCheck={false}
              placeholder='粘贴 {"model","messages"} …'
              aria-label="原始请求"
              onChange={(event) => setSource(event.target.value)}
            />
          </div>
        ) : null}
      </section>

      {hasBench ? (
        <div className="bench">
          <section className="panel bench-state">
            <div className="panel-head">
              <div>
                <h2>State</h2>
                <p>换数据只改这里，问题保持不变。</p>
              </div>
              <button type="button" className="btn" disabled={!conversion || !stateParsed.success} onClick={blankState}>
                清空
              </button>
            </div>
            {conversion ? (
              <div className="sample-row">
                <FitBadge fit={conversion.fit} />
                <span className="quiet">{conversion.summary}</span>
              </div>
            ) : null}
            {conversion && conversion.warnings.length > 0 ? (
              <details className="hint">
                <summary>{conversion.warnings.length} 条拆分说明</summary>
                {conversion.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </details>
            ) : null}
            <StateEditor
              text={stateText}
              fields={conversion?.fields ?? []}
              revision={revision}
              onTextChange={setStateText}
            />
          </section>

          <section className="panel bench-results" ref={resultsRef}>
            <div className="panel-head">
              <div>
                <h2>结果</h2>
                <p>
                  {response?.model ? response.model : "还没有运行"}
                  {response?.usage?.input_tokens !== undefined ? ` · ${response.usage.input_tokens} tokens` : ""}
                  {stale ? " · 下面是上次的结果" : ""}
                </p>
              </div>
            </div>
            <QuestionEditor
              text={questionsText}
              notes={conversion?.questionNotes ?? []}
              answers={response?.answers ?? null}
              stale={stale}
              onTextChange={setQuestionsText}
            />
            <div className="pack-bar">
              <input
                className="plain-input"
                value={packTitle}
                onChange={(event) => setPackTitle(event.target.value)}
                aria-label="问题组名称"
                placeholder="问题组名称"
              />
              <button type="button" className="btn" onClick={savePack}>
                保存问题
              </button>
              <button
                type="button"
                className="btn"
                disabled={!requestPreview}
                onClick={async () => {
                  await copyText(requestPreview);
                  setStatus("已复制 System One 请求。");
                  setError("");
                }}
              >
                复制请求
              </button>
            </div>
            {packs.length > 0 ? (
              <div className="pack-row">
                {packs.map((pack) => (
                  <span key={pack.id} className="actions">
                    <button type="button" className="btn" onClick={() => loadPack(pack)}>
                      用「{pack.title}」
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setPacks((current) => current.filter((item) => item.id !== pack.id))}
                    >
                      删除
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="empty-bench">载入示例，或拆开一段请求。左边换事实，右边看每个问题的概率。</div>
      )}

      <div className="dock">
        <p className="dock-status" data-error={Boolean(error)}>
          {error || (stale ? "State 已变化，结果还是上一次的。" : status) || "改 State 后直接运行。Ctrl / ⌘ Enter"}
        </p>
        <button type="button" className="btn btn-copper" disabled={busy !== null || !requestPreview} onClick={run}>
          {busy === "run" ? "运行中…" : stale ? "重新运行" : "运行 Jev"}
        </button>
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
