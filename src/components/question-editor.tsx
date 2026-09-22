"use client";

import { useMemo, useState } from "react";
import { JudgmentList, JudgmentRow } from "@/components/judgment-row";
import { pretty } from "@/lib/conversion";
import { questionsSchema, type Answer, type Question, type QuestionNote, type Questions } from "@/lib/types";

export function QuestionEditor({
  text,
  notes,
  answers = null,
  stale = false,
  onTextChange,
}: {
  text: string;
  notes: QuestionNote[];
  answers?: Record<string, Answer> | null;
  stale?: boolean;
  onTextChange: (text: string) => void;
}) {
  const [mode, setMode] = useState<"cards" | "json">("cards");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const parsed = useMemo(() => {
    try {
      const json = JSON.parse(text) as unknown;
      const result = questionsSchema.safeParse(json);
      if (!result.success) return { ok: false as const, error: "问题结构还不完整，可以切到 JSON 改" };
      return { ok: true as const, value: result.data };
    } catch {
      return { ok: false as const, error: "Questions 的 JSON 无法解析" };
    }
  }, [text]);

  const update = (next: Questions) => onTextChange(pretty(next));

  return (
    <div>
      <div className="tab-row" role="tablist">
        <button type="button" className="tab" data-active={mode === "cards"} onClick={() => setMode("cards")}>
          列表
        </button>
        <button type="button" className="tab" data-active={mode === "json"} onClick={() => setMode("json")}>
          JSON
        </button>
      </div>
      {mode === "json" || !parsed.ok ? (
        <>
          {!parsed.ok ? <p className="error-text">{parsed.error}</p> : null}
          <textarea
            className="editor"
            value={text}
            spellCheck={false}
            aria-label="Questions JSON"
            onChange={(event) => onTextChange(event.target.value)}
          />
        </>
      ) : (
        <>
          <JudgmentList>
            {Object.entries(parsed.value).map(([id, question]) => (
              <QuestionCard
                key={id}
                id={id}
                question={question}
                purpose={notes.find((note) => note.id === id)?.purpose}
                answer={answers?.[id]}
                stale={stale}
                open={openId === id}
                editing={editingId === id}
                onToggle={() => {
                  setOpenId((current) => (current === id ? null : id));
                  if (openId === id) setEditingId(null);
                }}
                onEdit={() => setEditingId((current) => (current === id ? null : id))}
                onChange={(next) => update({ ...parsed.value, [id]: next })}
                onDelete={() => {
                  const next = { ...parsed.value };
                  delete next[id];
                  update(next);
                }}
              />
            ))}
          </JudgmentList>
          <AddQuestion
            onAdd={(question) => {
              const id = nextId(parsed.value);
              update({ ...parsed.value, [id]: question });
              setOpenId(id);
              setEditingId(id);
            }}
          />
        </>
      )}
    </div>
  );
}

function QuestionCard({
  id,
  question,
  purpose,
  answer,
  stale,
  open,
  editing,
  onToggle,
  onEdit,
  onChange,
  onDelete,
}: {
  id: string;
  question: Question;
  purpose?: string;
  answer?: Answer;
  stale: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChange: (question: Question) => void;
  onDelete: () => void;
}) {
  const instruction = typeof question.instructions === "string" ? question.instructions : null;

  return (
    <JudgmentRow id={id} question={question} answer={answer} stale={stale} open={open} onToggle={onToggle}>
      {purpose ? <p className="j-purpose">{purpose}</p> : null}
      {editing ? (
        <div className="q-edit">
          {instruction === null ? null : (
            <label className="field">
              <span>判断</span>
              <textarea
                className="editor short"
                value={instruction}
                onChange={(event) => onChange({ ...question, instructions: event.target.value })}
              />
            </label>
          )}
          <CriteriaEditor question={question} onChange={onChange} />
        </div>
      ) : null}
      <div className="j-actions">
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          {editing ? "收起编辑" : "编辑"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDelete}>
          删除
        </button>
      </div>
    </JudgmentRow>
  );
}

function CriteriaEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (question: Question) => void;
}) {
  if (question.type === "choice") {
    const entries = Object.entries(question.criteria);
    if (entries.some(([, value]) => typeof value !== "string" && value !== null)) {
      return <p className="quiet">选项说明是结构化的，请在 JSON 里改。</p>;
    }
    return (
      <div>
        {entries.map(([key, value], index) => (
          <div className="option-row" key={index}>
            <input
              className="plain-input"
              value={key}
              aria-label={`${key} 的选项 id`}
              onChange={(event) => onChange({ ...question, criteria: renameKey(question.criteria, key, event.target.value) })}
            />
            <input
              className="plain-input"
              value={typeof value === "string" ? value : ""}
              aria-label={`${key} 的说明`}
              onChange={(event) =>
                onChange({ ...question, criteria: { ...question.criteria, [key]: event.target.value } })
              }
            />
            <button
              type="button"
              className="btn"
              disabled={entries.length <= 1}
              onClick={() => onChange({ ...question, criteria: omitKey(question.criteria, key) })}
            >
              去掉
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() =>
            onChange({
              ...question,
              criteria: { ...question.criteria, [freshKey(question.criteria, "option")]: "" },
            })
          }
        >
          添加选项
        </button>
      </div>
    );
  }

  if (question.type === "score") {
    if (question.criteria.some((level) => typeof level !== "string")) {
      return <p className="quiet">等级说明是结构化的，请在 JSON 里改。</p>;
    }
    const levels = question.criteria as string[];
    return (
      <div className="field-stack">
        {levels.map((level, index) => (
          <div className="option-row" key={index}>
            <input className="plain-input" value={String(index)} readOnly aria-label={`等级 ${index}`} />
            <input
              className="plain-input"
              value={level}
              aria-label={`等级 ${index} 的说明`}
              onChange={(event) => {
                const next = [...levels];
                next[index] = event.target.value;
                onChange({ ...question, criteria: next });
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={levels.length <= 2}
              onClick={() => onChange({ ...question, criteria: levels.filter((_, item) => item !== index) })}
            >
              去掉
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          disabled={levels.length >= 10}
          onClick={() => onChange({ ...question, criteria: [...levels, ""] })}
        >
          添加等级
        </button>
      </div>
    );
  }

  const yes = typeof question.criteria?.true === "string" ? question.criteria.true : "";
  const no = typeof question.criteria?.false === "string" ? question.criteria.false : "";
  const structured =
    (question.criteria?.true !== undefined && typeof question.criteria.true !== "string") ||
    (question.criteria?.false !== undefined && typeof question.criteria.false !== "string");
  if (structured) return <p className="quiet">是非边界是结构化的，请在 JSON 里改。</p>;

  return (
    <div className="field-stack">
      <label className="field">
        <span>接近 1 的含义</span>
        <input
          className="plain-input"
          value={yes}
          onChange={(event) =>
            onChange({ ...question, criteria: { ...question.criteria, true: event.target.value } })
          }
        />
      </label>
      <label className="field">
        <span>接近 0 的含义</span>
        <input
          className="plain-input"
          value={no}
          onChange={(event) =>
            onChange({ ...question, criteria: { ...question.criteria, false: event.target.value } })
          }
        />
      </label>
    </div>
  );
}

function AddQuestion({ onAdd }: { onAdd: (question: Question) => void }) {
  return (
    <div className="actions">
      <button
        type="button"
        className="btn"
        onClick={() => onAdd({ type: "noul", instructions: "这里写一个是否判断，并用 `字段` 指向 State。" })}
      >
        加一个 Noul
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          onAdd({
            type: "choice",
            instructions: "这里写要选哪一个，并用 `字段` 指向 State。",
            criteria: { yes: "", no: "", other: "以上都不是" },
          })
        }
      >
        加一个 Choice
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          onAdd({
            type: "score",
            instructions: "这里写要沿哪条刻度打分，并用 `字段` 指向 State。",
            criteria: ["低", "中", "高"],
          })
        }
      >
        加一个 Score
      </button>
    </div>
  );
}

function nextId(questions: Questions): string {
  let index = Object.keys(questions).length + 1;
  while (questions[`question_${index}`]) index += 1;
  return `question_${index}`;
}

function freshKey(criteria: Record<string, unknown>, prefix: string): string {
  let index = Object.keys(criteria).length + 1;
  while (criteria[`${prefix}_${index}`]) index += 1;
  return `${prefix}_${index}`;
}

function renameKey<T>(criteria: Record<string, T>, from: string, to: string): Record<string, T> {
  if (!to.trim() || to === from || criteria[to] !== undefined) return criteria;
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(criteria)) {
    next[key === from ? to : key] = value;
  }
  return next;
}

function omitKey<T>(criteria: Record<string, T>, key: string): Record<string, T> {
  const next = { ...criteria };
  delete next[key];
  return next;
}
