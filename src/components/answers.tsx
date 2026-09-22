import type { Answer, SystemOneResponse } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fitLabel = {
  judgment: "可直接判断",
  mixed: "部分判断",
  generative: "原本在生成文字",
} as const;

export function FitBadge({ fit }: { fit: keyof typeof fitLabel }) {
  return <Badge variant="secondary">{fitLabel[fit]}</Badge>;
}

export function answerVerdict(answer: Answer | undefined): string {
  if (!answer) return "未运行";
  if (answer.type === "noul" && typeof answer.noul === "number") return answer.noul.toFixed(2);
  if (answer.type === "choice") return answer.choice || "—";
  if (answer.type === "score" && typeof answer.score === "number") return answer.score.toFixed(2);
  return "—";
}

export function AnswerReadout({ answer, stale = false }: { answer: Answer; stale?: boolean }) {
  return (
    <div className="mt-2.5" data-stale={stale}>
      <div className="flex items-baseline gap-2">
        <strong className="font-heading text-[28px] font-medium tracking-tight">{answerVerdict(answer)}</strong>
        {stale ? <span className="text-xs text-copper">上次</span> : null}
        {answer.type !== "noul" && typeof answer.confidence === "number" ? (
          <span className="text-sm text-muted-foreground">confidence {answer.confidence.toFixed(2)}</span>
        ) : null}
      </div>
      <AnswerBody answer={answer} compact />
    </div>
  );
}

export function Answers({ response }: { response: SystemOneResponse }) {
  const entries = Object.entries(response.answers ?? {});

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Jev 的回答</CardTitle>
        <CardDescription>
          {response.model ? `实际模型 ${response.model}` : "已返回"}
          {response.usage?.input_tokens !== undefined ? ` · 输入 ${response.usage.input_tokens} tokens` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">响应里没有 answers。</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {entries.map(([id, answer]) => (
            <article className="rounded-xl border bg-card p-3" key={id}>
              <header className="mb-2 flex items-center justify-between gap-2">
                <strong>{id}</strong>
                <Badge variant="outline">{answer.type}</Badge>
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
  if (answer.type === "noul") {
    return (
      <>
        {compact ? null : <div className="font-heading text-4xl tracking-tight">{answer.noul.toFixed(2)}</div>}
        <Meter label="yes 的概率" value={answer.noul} />
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
