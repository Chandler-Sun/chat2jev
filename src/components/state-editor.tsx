"use client";

import { useMemo, useState } from "react";
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
    <div>
      <div className="tab-row" role="tablist">
        <button type="button" className="tab" data-active={mode === "fields"} onClick={() => setMode("fields")}>
          字段
        </button>
        <button type="button" className="tab" data-active={mode === "json"} onClick={() => setMode("json")}>
          JSON
        </button>
      </div>
      {showFields ? (
        <div className="field-stack" key={revision}>
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
        </div>
      ) : (
        <>
          {!parsed.ok ? <p className="error-text">{parsed.error}</p> : null}
          {parsed.ok && !isRecord(parsed.value) ? (
            <p className="quiet">这份 State 是{Array.isArray(parsed.value) ? "数组" : "一段文本"}，直接在 JSON 里替换。</p>
          ) : null}
          <textarea
            className="editor"
            value={text}
            spellCheck={false}
            aria-label="State JSON"
            onChange={(event) => onTextChange(event.target.value)}
          />
        </>
      )}
    </div>
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
    <label className="field">
      <span>
        {name}
        {replaceable ? " · 可替换" : ""}
      </span>
      <textarea
        className="editor short"
        value={shown}
        spellCheck={isString}
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
      {note ? <span className="quiet">{note}</span> : null}
      {draft ? <span className="error-text">这段 JSON 还没写完</span> : null}
    </label>
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
