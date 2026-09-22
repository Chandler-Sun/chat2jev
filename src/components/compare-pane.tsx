"use client";

import { MessageSquareTextIcon, ScaleIcon } from "lucide-react";
import { JudgmentList, JudgmentRow } from "@/components/judgment-row";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { questionsSchema, type Answer, type QuestionNote, type SystemOneResponse } from "@/lib/types";

export type ChatRun = {
  content: string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  latencyMs: number;
};

export function ComparePane({
  questionsText,
  notes,
  chat,
  chatError,
  jev,
  jevError,
  stale,
  chatStale,
}: {
  questionsText: string;
  notes: QuestionNote[];
  chat: ChatRun | null;
  chatError: string;
  jev: SystemOneResponse | null;
  jevError: string;
  stale: boolean;
  chatStale: boolean;
}) {
  const questions = parseQuestions(questionsText);

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-2" aria-label="传统 Chat Completion">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Chat</Badge>
            <span className="text-sm font-medium">传统生成</span>
          </div>
          <MetaLine model={chat?.model} tokens={chat?.usage?.completion_tokens} latencyMs={chat?.latencyMs} />
        </div>
        {chatError ? <p className="text-sm text-destructive">{chatError}</p> : null}
        {chatStale && chat ? <p className="text-xs text-copper">原请求已改，下方是上次 Chat 结果</p> : null}
        {chat ? (
          <pre className="min-h-40 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border bg-card p-3 font-sans text-sm leading-relaxed">
            {chat.content}
          </pre>
        ) : (
          <Empty className="min-h-40 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquareTextIcon />
              </EmptyMedia>
              <EmptyTitle>还没有 Chat 结果</EmptyTitle>
              <EmptyDescription>用原请求跑一遍传统 chat completion，看它生成的文字或 JSON。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2" aria-label="Jev System One">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Jev</Badge>
            <span className="text-sm font-medium">结构化判断</span>
          </div>
          <MetaLine model={jev?.model} tokens={jev?.usage?.input_tokens} />
        </div>
        {jevError ? <p className="text-sm text-destructive">{jevError}</p> : null}
        {stale && jev ? <p className="text-xs text-copper">State 已改，下方是上次 Jev 结果</p> : null}
        {questions && jev ? (
          <JudgmentList>
            {Object.entries(questions).map(([id, question]) => (
              <JudgmentRow key={id} id={id} question={question} answer={jev.answers?.[id]} stale={stale} open onToggle={() => undefined} />
            ))}
          </JudgmentList>
        ) : questions && !jev ? (
          <JudgmentList>
            {Object.entries(questions).map(([id, question]) => (
              <JudgmentRow key={id} id={id} question={question} open={false} onToggle={() => undefined}>
                {notes.find((note) => note.id === id)?.purpose ? (
                  <p className="j-purpose">
                    <Badge variant="secondary">业务目的</Badge>
                    {notes.find((note) => note.id === id)?.purpose}
                  </p>
                ) : null}
              </JudgmentRow>
            ))}
          </JudgmentList>
        ) : (
          <Empty className="min-h-40 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScaleIcon />
              </EmptyMedia>
              <EmptyTitle>还没有 Jev 结果</EmptyTitle>
              <EmptyDescription>转换出 Questions 后运行，这里会按 TypeSafe playground 的方式展示概率。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  );
}

function MetaLine({
  model,
  tokens,
  latencyMs,
}: {
  model?: string;
  tokens?: number;
  latencyMs?: number;
}) {
  const parts = [
    model,
    tokens !== undefined ? `${tokens} tok` : null,
    latencyMs !== undefined ? `${(latencyMs / 1000).toFixed(1)}s` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="truncate text-xs text-muted-foreground">{parts.join(" · ")}</span>;
}

function parseQuestions(text: string) {
  try {
    const parsed = questionsSchema.safeParse(JSON.parse(text) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
