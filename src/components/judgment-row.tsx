import type { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { Answer, ChoiceAnswer, Question } from "@/lib/types";

export function JudgmentList({ children }: { children: ReactNode }) {
  return <div className="j-list">{children}</div>;
}

export function JudgmentRow({
  id,
  question,
  answer,
  stale = false,
  open,
  onToggle,
  children,
}: {
  id: string;
  question: Question;
  answer?: Answer;
  stale?: boolean;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const matched = answer && answer.type === question.type ? answer : undefined;
  const instruction = instructionOf(question);

  return (
    <article className="j-row" id={`q-${id}`} data-open={open} data-stale={Boolean(matched && stale)}>
      <button type="button" className="j-toggle" aria-expanded={open} onClick={onToggle}>
        <ChevronRightIcon className="j-chevron" />
        <span className="j-copy">
          <strong className="j-id">{id}</strong>
          <span className="j-instruction">{instruction || "这条指令是结构化的，展开后在 JSON 里改。"}</span>
        </span>
      </button>
      <Side question={question} answer={matched} stale={stale} />
      {open ? (
        <div className="j-expand">
          <CriteriaView question={question} answer={matched} />
          {children}
        </div>
      ) : null}
    </article>
  );
}

function Side({ question, answer, stale }: { question: Question; answer?: Answer; stale: boolean }) {
  const meta = metaLine(question, Boolean(answer));
  const bar = barValue(question, answer);
  const title = headline(question, answer);
  const alts = answer?.type === "choice" ? runnersUp(answer) : [];

  return (
    <div className="j-side">
      {title ? <strong className="j-value">{title}</strong> : null}
      {alts.map((alt) => (
        <span className="j-alt" key={alt.label}>
          {alt.percent === undefined ? alt.label : `${alt.label} ${alt.percent}%`}
        </span>
      ))}
      {answer && answer.type !== "noul" ? (
        <span className="j-confidence">
          Confidence: {Math.round(answer.confidence * 100)}%{stale ? " · 上次" : ""}
        </span>
      ) : stale && answer ? (
        <span className="j-confidence">上次</span>
      ) : null}
      {bar === null ? null : (
        <div className="j-track" aria-hidden="true">
          <span style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
      <span className="j-type">{typeLabel(question.type)}</span>
      {meta ? <span className="j-meta">{meta}</span> : null}
    </div>
  );
}

function CriteriaView({ question, answer }: { question: Question; answer?: Answer }) {
  if (question.type === "choice") {
    const probabilities = answer?.type === "choice" ? answer.probabilities : undefined;
    const winner = answer?.type === "choice" ? answer.choice : undefined;
    return (
      <ul className="j-criteria">
        {Object.entries(question.criteria).map(([key, value]) => (
          <Level
            key={key}
            name={key}
            detail={describe(value)}
            percent={percentOf(probabilities?.[key])}
            selected={winner === key}
          />
        ))}
      </ul>
    );
  }

  if (question.type === "score") {
    const probabilities = answer?.type === "score" ? answer.probabilities : undefined;
    const picked = answer?.type === "score" ? nearestLevel(answer.score, question.criteria.length) : undefined;
    return (
      <ul className="j-criteria">
        {question.criteria.map((level, index) => (
          <Level
            key={index}
            index={String(index)}
            name={describe(level) || `等级 ${index}`}
            percent={percentOf(probabilities?.[String(index)])}
            selected={picked === index}
          />
        ))}
      </ul>
    );
  }

  const yes = describe(question.criteria?.true);
  const no = describe(question.criteria?.false);
  const yesPercent = answer?.type === "noul" ? Math.round(answer.noul * 100) : undefined;
  const noPercent = yesPercent === undefined ? undefined : 100 - yesPercent;

  return (
    <ul className="j-criteria">
      <Level index="1" name="true" detail={yes} percent={yesPercent} selected={yesPercent !== undefined && yesPercent >= 50} />
      <Level index="0" name="false" detail={no} percent={noPercent} selected={noPercent !== undefined && noPercent > 50} />
    </ul>
  );
}

function Level({
  index,
  name,
  detail,
  percent,
  selected,
}: {
  index?: string;
  name: string;
  detail?: string;
  percent?: number;
  selected: boolean;
}) {
  const showDetail = detail && detail !== name;
  return (
    <li className="j-level" data-selected={selected}>
      <div className="j-level-head">
        {index ? <span className="j-level-index">{index}</span> : <span className="j-level-index" aria-hidden="true" />}
        <span className="j-level-name">{name}</span>
        {percent === undefined ? null : <span className="j-pct">{percent}%</span>}
      </div>
      {showDetail ? <p className="j-level-desc">{detail}</p> : null}
      {percent === undefined ? null : (
        <div className="j-track j-track-wide" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
    </li>
  );
}

function headline(question: Question, answer?: Answer): string {
  if (question.type === "score") {
    const max = Math.max(question.criteria.length - 1, 0);
    if (answer?.type !== "score") return `0–${max}`;
    return `${formatScore(answer.score)} of ${max}`;
  }
  if (question.type === "noul") {
    if (answer?.type !== "noul") return "yes / no";
    return `${Math.round(answer.noul * 100)}% true`;
  }
  if (answer?.type !== "choice") return "";
  return answer.choice || "—";
}

function metaLine(question: Question, hasAnswer: boolean): string {
  if (question.type === "score") {
    const count = question.criteria.length;
    return `${count} 级刻度 · 0–${Math.max(count - 1, 0)}`;
  }
  if (question.type === "choice") {
    const count = Object.keys(question.criteria).length;
    return `${count} 个候选选项`;
  }
  return hasAnswer ? "是非判断" : "概率 0–100%";
}

function barValue(question: Question, answer?: Answer): number | null {
  if (question.type === "noul") return answer?.type === "noul" ? clamp(answer.noul) : 0;
  if (question.type === "score" || answer?.type !== "choice") return null;
  const picked = answer.probabilities?.[answer.choice];
  return clamp(typeof picked === "number" ? picked : answer.confidence);
}

function runnersUp(answer: ChoiceAnswer): { label: string; percent?: number }[] {
  return Object.entries(answer.probabilities ?? {})
    .filter(([key]) => key !== answer.choice)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label, value]) => ({ label, percent: Math.round(value * 100) }));
}

function nearestLevel(score: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round(score)));
}

function percentOf(value: number | undefined): number | undefined {
  return typeof value === "number" ? Math.round(clamp(value) * 100) : undefined;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

function typeLabel(type: Question["type"]): string {
  if (type === "noul") return "Noul (是非)";
  if (type === "choice") return "Choice (单选)";
  return "Score (打分)";
}

function instructionOf(question: Question): string {
  const value = question.instructions;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const questionText = (value as Record<string, unknown>).question;
    if (typeof questionText === "string") return questionText;
  }
  return "";
}

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
