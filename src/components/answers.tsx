import type { Answer, SystemOneResponse } from "@/lib/types";

const fitLabel = {
  judgment: "可直接判断",
  mixed: "部分判断",
  generative: "原本在生成文字",
} as const;

export function FitBadge({ fit }: { fit: keyof typeof fitLabel }) {
  return <span className="badge">{fitLabel[fit]}</span>;
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
    <div className="readout" data-stale={stale}>
      <div className="readout-head">
        <strong className="verdict">{answerVerdict(answer)}</strong>
        {stale ? <span className="stale-tag">上次</span> : null}
        {answer.type !== "noul" && typeof answer.confidence === "number" ? (
          <span className="quiet">confidence {answer.confidence.toFixed(2)}</span>
        ) : null}
      </div>
      <AnswerBody answer={answer} compact />
    </div>
  );
}

export function Answers({ response }: { response: SystemOneResponse }) {
  const entries = Object.entries(response.answers ?? {});

  return (
    <section className="answer-board">
      <div className="panel-head">
        <div>
          <h2>Jev 的回答</h2>
          <p>
            {response.model ? `实际模型 ${response.model}` : "已返回"}
            {response.usage?.input_tokens !== undefined ? ` · 输入 ${response.usage.input_tokens} tokens` : ""}
          </p>
        </div>
      </div>
      {entries.length === 0 ? <p className="quiet">响应里没有 answers。</p> : null}
      <div className="answer-grid">
        {entries.map(([id, answer]) => (
          <article className="answer-card" key={id}>
            <header>
              <strong>{id}</strong>
              <span className="badge" data-type={answer.type}>
                {answer.type}
              </span>
            </header>
            <AnswerBody answer={answer} />
          </article>
        ))}
      </div>
    </section>
  );
}

function AnswerBody({ answer, compact = false }: { answer: Answer; compact?: boolean }) {
  if (answer.type === "noul") {
    return (
      <>
        {compact ? null : <div className="score-value">{answer.noul.toFixed(2)}</div>}
        <Meter label="yes 的概率" value={answer.noul} />
      </>
    );
  }

  if (answer.type === "choice") {
    const probabilities = answer.probabilities ?? {};
    const rows = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
    return (
      <>
        {compact ? null : <div className="score-value">{answer.choice}</div>}
        {compact ? null : <p className="quiet">confidence {answer.confidence.toFixed(2)}</p>}
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
      {compact ? null : <div className="score-value">{answer.score.toFixed(2)}</div>}
      {compact ? null : <p className="quiet">confidence {answer.confidence.toFixed(2)}</p>}
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
