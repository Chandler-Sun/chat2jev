"use client";

import { useMemo, useState } from "react";
import { BracesIcon, ListIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { JudgmentList, JudgmentRow } from "@/components/judgment-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  const showJson = mode === "json" || !parsed.ok;

  return (
    <Tabs value={showJson ? "json" : mode} onValueChange={(value) => setMode(value as "cards" | "json")} className="min-h-0 flex-1">
      <TabsList variant="line" className="shrink-0">
        <TabsTrigger value="cards">
          <ListIcon data-icon="inline-start" />
          列表
        </TabsTrigger>
        <TabsTrigger value="json">
          <BracesIcon data-icon="inline-start" />
          JSON
        </TabsTrigger>
      </TabsList>
      <TabsContent value="json" className="flex min-h-0 flex-1 flex-col gap-2">
        {!parsed.ok ? <p className="text-sm text-destructive">{parsed.error}</p> : null}
        <Textarea
          className="editor fill"
          value={text}
          spellCheck={false}
          aria-label="Questions JSON"
          onChange={(event) => onTextChange(event.target.value)}
        />
      </TabsContent>
      <TabsContent value="cards" className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {parsed.ok ? (
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
        ) : null}
      </TabsContent>
    </Tabs>
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
      {purpose ? (
        <p className="j-purpose">
          <Badge variant="secondary">业务目的</Badge>
          {purpose}
        </p>
      ) : null}
      {editing ? (
        <div className="mt-2.5 flex flex-col gap-3 border-t pt-2.5">
          {instruction === null ? null : (
            <Field>
              <FieldLabel>判断指令（Instructions，可用 `字段名` 引用 State）</FieldLabel>
              <Textarea
                className="editor short"
                value={instruction}
                onChange={(event) => onChange({ ...question, instructions: event.target.value })}
              />
            </Field>
          )}
          <CriteriaEditor question={question} onChange={onChange} />
        </div>
      ) : null}
      <div className="j-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          {editing ? "收起编辑" : "调整指令与选项"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          <Trash2Icon data-icon="inline-start" />
          删除维度
        </Button>
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
      return <p className="text-sm text-muted-foreground">选项说明是结构化的，请在 JSON 里改。</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        {entries.map(([key, value], index) => (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto]" key={index}>
            <Input
              value={key}
              aria-label={`${key} 的选项 id`}
              onChange={(event) => onChange({ ...question, criteria: renameKey(question.criteria, key, event.target.value) })}
            />
            <Input
              value={typeof value === "string" ? value : ""}
              aria-label={`${key} 的说明`}
              onChange={(event) =>
                onChange({ ...question, criteria: { ...question.criteria, [key]: event.target.value } })
              }
            />
            <Button
              type="button"
              variant="outline"
              disabled={entries.length <= 1}
              onClick={() => onChange({ ...question, criteria: omitKey(question.criteria, key) })}
            >
              去掉
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...question,
              criteria: { ...question.criteria, [freshKey(question.criteria, "option")]: "" },
            })
          }
        >
          <PlusIcon data-icon="inline-start" />
          添加选项
        </Button>
      </div>
    );
  }

  if (question.type === "score") {
    if (question.criteria.some((level) => typeof level !== "string")) {
      return <p className="text-sm text-muted-foreground">等级说明是结构化的，请在 JSON 里改。</p>;
    }
    const levels = question.criteria as string[];
    return (
      <div className="flex flex-col gap-2">
        {levels.map((level, index) => (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto]" key={index}>
            <Input value={String(index)} readOnly aria-label={`等级 ${index}`} />
            <Input
              value={level}
              aria-label={`等级 ${index} 的说明`}
              onChange={(event) => {
                const next = [...levels];
                next[index] = event.target.value;
                onChange({ ...question, criteria: next });
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={levels.length <= 2}
              onClick={() => onChange({ ...question, criteria: levels.filter((_, item) => item !== index) })}
            >
              去掉
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={levels.length >= 10}
          onClick={() => onChange({ ...question, criteria: [...levels, ""] })}
        >
          <PlusIcon data-icon="inline-start" />
          添加等级
        </Button>
      </div>
    );
  }

  const yes = typeof question.criteria?.true === "string" ? question.criteria.true : "";
  const no = typeof question.criteria?.false === "string" ? question.criteria.false : "";
  const structured =
    (question.criteria?.true !== undefined && typeof question.criteria.true !== "string") ||
    (question.criteria?.false !== undefined && typeof question.criteria.false !== "string");
  if (structured) return <p className="text-sm text-muted-foreground">是非边界是结构化的，请在 JSON 里改。</p>;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>接近 1 的含义</FieldLabel>
        <Input
          value={yes}
          onChange={(event) =>
            onChange({ ...question, criteria: { ...question.criteria, true: event.target.value } })
          }
        />
      </Field>
      <Field>
        <FieldLabel>接近 0 的含义</FieldLabel>
        <Input
          value={no}
          onChange={(event) =>
            onChange({ ...question, criteria: { ...question.criteria, false: event.target.value } })
          }
        />
      </Field>
    </FieldGroup>
  );
}

function AddQuestion({ onAdd }: { onAdd: (question: Question) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-tone="noul"
        onClick={() => onAdd({ type: "noul", instructions: "这里写一个是否判断，并用 `字段` 指向 State。" })}
      >
        <PlusIcon data-icon="inline-start" />
        是非判断 (Noul)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-tone="choice"
        onClick={() =>
          onAdd({
            type: "choice",
            instructions: "这里写要选哪一个，并用 `字段` 指向 State。",
            criteria: { yes: "", no: "", other: "以上都不是" },
          })
        }
      >
        <PlusIcon data-icon="inline-start" />
        单选分类 (Choice)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-tone="score"
        onClick={() =>
          onAdd({
            type: "score",
            instructions: "这里写要沿哪条刻度打分，并用 `字段` 指向 State。",
            criteria: ["低", "中", "高"],
          })
        }
      >
        <PlusIcon data-icon="inline-start" />
        程度打分 (Score)
      </Button>
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
