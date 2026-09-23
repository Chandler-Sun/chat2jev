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
import { useI18n } from "@/components/locale-provider";
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
  const { t } = useI18n();
  const [mode, setMode] = useState<"cards" | "json">("cards");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const parsed = useMemo(() => {
    try {
      const json = JSON.parse(text) as unknown;
      const result = questionsSchema.safeParse(json);
      if (!result.success) return { ok: false as const, error: t("questions.badStructure") };
      return { ok: true as const, value: result.data };
    } catch {
      return { ok: false as const, error: t("questions.badJson") };
    }
  }, [text, t]);

  const update = (next: Questions) => onTextChange(pretty(next));
  const showJson = mode === "json" || !parsed.ok;

  return (
    <Tabs value={showJson ? "json" : mode} onValueChange={(value) => setMode(value as "cards" | "json")} className="min-h-0 flex-1">
      <TabsList variant="line" className="shrink-0">
        <TabsTrigger value="cards">
          <ListIcon data-icon="inline-start" />
          {t("questions.list")}
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
  const { t } = useI18n();
  const instruction = typeof question.instructions === "string" ? question.instructions : null;

  return (
    <JudgmentRow id={id} question={question} answer={answer} stale={stale} open={open} onToggle={onToggle}>
      {purpose ? (
        <p className="j-purpose">
          <Badge variant="secondary">{t("questions.purpose")}</Badge>
          {purpose}
        </p>
      ) : null}
      {editing ? (
        <div className="mt-2.5 flex flex-col gap-3 border-t pt-2.5">
          {instruction === null ? null : (
            <Field>
              <FieldLabel>{t("questions.instructions")}</FieldLabel>
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
          {editing ? t("questions.editClose") : t("questions.edit")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          <Trash2Icon data-icon="inline-start" />
          {t("questions.delete")}
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
  const { t } = useI18n();
  if (question.type === "choice") {
    const entries = Object.entries(question.criteria);
    if (entries.some(([, value]) => typeof value !== "string" && value !== null)) {
      return <p className="text-sm text-muted-foreground">{t("questions.choiceStructured")}</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        {entries.map(([key, value], index) => (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto]" key={index}>
            <Input
              value={key}
              aria-label={t("questions.optionId", { key })}
              onChange={(event) => onChange({ ...question, criteria: renameKey(question.criteria, key, event.target.value) })}
            />
            <Input
              value={typeof value === "string" ? value : ""}
              aria-label={t("questions.optionDesc", { key })}
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
              {t("questions.remove")}
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
          {t("questions.addOption")}
        </Button>
      </div>
    );
  }

  if (question.type === "score") {
    if (question.criteria.some((level) => typeof level !== "string")) {
      return <p className="text-sm text-muted-foreground">{t("questions.scoreStructured")}</p>;
    }
    const levels = question.criteria as string[];
    return (
      <div className="flex flex-col gap-2">
        {levels.map((level, index) => (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto]" key={index}>
            <Input value={String(index)} readOnly aria-label={t("questions.level", { index })} />
            <Input
              value={level}
              aria-label={t("questions.levelDesc", { index })}
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
              {t("questions.remove")}
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
          {t("questions.addLevel")}
        </Button>
      </div>
    );
  }

  const yes = typeof question.criteria?.true === "string" ? question.criteria.true : "";
  const no = typeof question.criteria?.false === "string" ? question.criteria.false : "";
  const structured =
    (question.criteria?.true !== undefined && typeof question.criteria.true !== "string") ||
    (question.criteria?.false !== undefined && typeof question.criteria.false !== "string");
  if (structured) return <p className="text-sm text-muted-foreground">{t("questions.noulStructured")}</p>;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("questions.trueMeans")}</FieldLabel>
        <Input
          value={yes}
          onChange={(event) =>
            onChange({ ...question, criteria: { ...question.criteria, true: event.target.value } })
          }
        />
      </Field>
      <Field>
        <FieldLabel>{t("questions.falseMeans")}</FieldLabel>
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
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-tone="noul"
        onClick={() => onAdd({ type: "noul", instructions: t("questions.noulDraft") })}
      >
        <PlusIcon data-icon="inline-start" />
        {t("questions.addNoul")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-tone="choice"
        onClick={() =>
          onAdd({
            type: "choice",
            instructions: t("questions.choiceDraft"),
            criteria: { yes: "", no: "", other: t("questions.other") },
          })
        }
      >
        <PlusIcon data-icon="inline-start" />
        {t("questions.addChoice")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-tone="score"
        onClick={() =>
          onAdd({
            type: "score",
            instructions: t("questions.scoreDraft"),
            criteria: [t("questions.low"), t("questions.mid"), t("questions.high")],
          })
        }
      >
        <PlusIcon data-icon="inline-start" />
        {t("questions.addScore")}
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
