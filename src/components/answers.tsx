"use client";

import type { Answer, SystemOneResponse } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MessageKey } from "@/lib/i18n";

const fitKey = {
  judgment: "fit.judgment",
  mixed: "fit.mixed",
  generative: "fit.generative",
} as const satisfies Record<string, MessageKey>;

export function FitBadge({ fit }: { fit: keyof typeof fitKey }) {
  const { t } = useI18n();
  const tone = fit === "judgment" ? "moss" : fit === "mixed" ? "ochre" : "ink";
  return (
    <Badge variant="outline" data-tone={tone}>
      {t(fitKey[fit])}
    </Badge>
  );
}

export function answerVerdict(answer: Answer | undefined, notRun = "—"): string {
  if (!answer) return notRun;
  if (answer.type === "noul" && typeof answer.noul === "number") return answer.noul.toFixed(2);
  if (answer.type === "choice") return answer.choice || "—";
  if (answer.type === "score" && typeof answer.score === "number") return answer.score.toFixed(2);
  return "—";
}

export function AnswerReadout({ answer, stale = false }: { answer: Answer; stale?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mt-2.5" data-stale={stale}>
      <div className="flex items-baseline gap-2">
        <strong className="font-heading text-[28px] font-medium tracking-tight">{answerVerdict(answer, t("judge.notRun"))}</strong>
        {stale ? <span className="text-xs text-copper">{t("judge.last")}</span> : null}
        {answer.type !== "noul" && typeof answer.confidence === "number" ? (
          <span className="text-sm text-muted-foreground">confidence {answer.confidence.toFixed(2)}</span>
        ) : null}
      </div>
      <AnswerBody answer={answer} compact />
    </div>
  );
}

export function Answers({ response }: { response: SystemOneResponse }) {
  const { t } = useI18n();
  const entries = Object.entries(response.answers ?? {});

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("answers.title")}</CardTitle>
        <CardDescription>
          {response.model ? t("answers.model", { model: response.model }) : t("answers.returned")}
          {response.usage?.input_tokens !== undefined ? t("answers.tokens", { tokens: response.usage.input_tokens }) : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">{t("answers.none")}</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {entries.map(([id, answer]) => (
            <article className="rounded-xl border bg-card p-3" key={id}>
              <header className="mb-2 flex items-center justify-between gap-2">
                <strong>{id}</strong>
                <Badge variant="outline" data-tone={answer.type}>
                  {answer.type}
                </Badge>
              </header>
              <AnswerBody answer={answer} />
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AnswerBody({ answer, compact = false }: { answer: Answer; compact?: boolean }) {
  const { t } = useI18n();
  if (answer.type === "noul") {
    return (
      <>
        {compact ? null : <div className="font-heading text-4xl tracking-tight">{answer.noul.toFixed(2)}</div>}
        <Meter label={t("answers.yesProb")} value={answer.noul} />
      </>
    );
  }

  if (answer.type === "choice") {
    const probabilities = answer.probabilities ?? {};
    const rows = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
    return (
      <>
        {compact ? null : <div className="font-heading text-4xl tracking-tight">{answer.choice}</div>}
        {compact ? null : <p className="text-sm text-muted-foreground">confidence {answer.confidence.toFixed(2)}</p>}
        {rows.map(([option, probability]) => (
          <Meter key={option} label={option} value={probability} />
        ))}
      </>
    );
  }

  const probabilities = answer.probabilities ?? {};
  const rows = Object.entries(probabilities).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <>
      {compact ? null : <div className="font-heading text-4xl tracking-tight">{answer.score.toFixed(2)}</div>}
      {compact ? null : <p className="text-sm text-muted-foreground">confidence {answer.confidence.toFixed(2)}</p>}
      {rows.map(([level, probability]) => (
        <Meter key={level} label={answer.legend?.[level] ?? level} value={probability} />
      ))}
    </>
  );
}

export function Meter({ label, value }: { label: string; value: number }) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <span style={{ width }} />
      </div>
    </div>
  );
}
