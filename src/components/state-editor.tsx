"use client";

import { useMemo, useState } from "react";
import { BracesIcon, ListChecksIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FieldNote } from "@/lib/types";
import { pretty } from "@/lib/conversion";

export function StateEditor({
  text,
  fields,
  revision,
  onTextChange,
}: {
  text: string;
  fields: FieldNote[];
  revision: number;
  onTextChange: (text: string) => void;
}) {
  const [mode, setMode] = useState<"fields" | "json">("fields");
  const parsed = useMemo(() => parseLoose(text), [text]);
  const record = parsed.ok && isRecord(parsed.value) ? parsed.value : null;
  const showFields = mode === "fields" && record !== null;

  return (
    <Tabs value={showFields ? mode : "json"} onValueChange={(value) => setMode(value as "fields" | "json")}>
      <TabsList variant="line">
        <TabsTrigger value="fields">
          <ListChecksIcon data-icon="inline-start" />
          字段
        </TabsTrigger>
        <TabsTrigger value="json">
          <BracesIcon data-icon="inline-start" />
          JSON
        </TabsTrigger>
      </TabsList>
      <TabsContent value="fields" className="flex flex-col gap-3" key={revision}>
        {Object.entries(record ?? {}).map(([key, value]) => (
          <FieldControl
            key={key}
            name={key}
            value={value}
            note={fields.find((field) => field.path === key)?.description}
            replaceable={fields.find((field) => field.path === key)?.replaceable}
            onChange={(next) => onTextChange(pretty({ ...(record ?? {}), [key]: next }))}
          />
        ))}
      </TabsContent>
      <TabsContent value="json" className="flex flex-col gap-2">
        {!parsed.ok ? <p className="text-sm text-destructive">{parsed.error}</p> : null}
        {parsed.ok && !isRecord(parsed.value) ? (
          <p className="text-sm text-muted-foreground">这份 State 是{Array.isArray(parsed.value) ? "数组" : "一段文本"}，直接在 JSON 里替换。</p>
        ) : null}
        <Textarea
          className="editor"
          value={text}
          spellCheck={false}
          aria-label="State JSON"
          onChange={(event) => onTextChange(event.target.value)}
        />
      </TabsContent>
    </Tabs>
  );
}

function FieldControl({
  name,
  value,
  note,
  replaceable,
  onChange,
}: {
  name: string;
  value: unknown;
  note?: string;
  replaceable?: boolean;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const isString = typeof value === "string";
  const shown = draft ?? (isString ? value : JSON.stringify(value, null, 2));

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel className="font-mono text-sm">{name}</FieldLabel>
        <Badge variant={replaceable ? "secondary" : "outline"}>{replaceable ? "待测字段" : "固定上下文"}</Badge>
      </div>
      <Textarea
        className="editor short"
        value={shown}
        spellCheck={isString}
        aria-label={name}
        onChange={(event) => {
          const next = event.target.value;
          if (isString) {
            onChange(next);
            return;
          }
          setDraft(next);
          try {
            onChange(JSON.parse(next) as unknown);
            setDraft(null);
          } catch {
            // Keep the draft until the JSON is valid again.
          }
        }}
      />
      {note ? <FieldDescription>{note}</FieldDescription> : null}
      {draft ? <p className="text-sm text-destructive">这段 JSON 还没写完</p> : null}
    </Field>
  );
}

function parseLoose(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "State 的 JSON 无法解析" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
