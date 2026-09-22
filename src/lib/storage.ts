import { conversionSchema, type Conversion, type QuestionNote, type Questions } from "./types";

export type Settings = {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  typesafeApiKey: string;
  typesafeModel: string;
  rememberKeys: boolean;
};

export type QuestionPack = {
  id: string;
  title: string;
  savedAt: string;
  summary: string;
  questions: Questions;
  questionNotes: QuestionNote[];
};

export type Draft = {
  source: string;
  stateText: string;
  questionsText: string;
  conversion: Conversion | null;
};

export type StoredWorkbench = {
  settings: Settings;
  packs: QuestionPack[];
  draft: Draft;
};

export const defaultSettings: Settings = {
  llmBaseUrl: "https://api.openai.com/v1",
  llmApiKey: "",
  llmModel: "gpt-4.1-mini",
  typesafeApiKey: "",
  typesafeModel: "jev-latest",
  rememberKeys: true,
};

export const emptyDraft: Draft = {
  source: "",
  stateText: "",
  questionsText: "",
  conversion: null,
};

const STORAGE_KEY = "jev-lab.v1";

export function loadWorkbench(): StoredWorkbench | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorkbench>;
    const rawDraft = (parsed.draft ?? {}) as Partial<Draft>;
    const conversion = conversionSchema.safeParse(rawDraft.conversion);
    return {
      settings: { ...defaultSettings, ...parsed.settings },
      packs: Array.isArray(parsed.packs) ? parsed.packs : [],
      draft: {
        source: typeof rawDraft.source === "string" ? rawDraft.source : "",
        stateText: typeof rawDraft.stateText === "string" ? rawDraft.stateText : "",
        questionsText: typeof rawDraft.questionsText === "string" ? rawDraft.questionsText : "",
        conversion: conversion.success ? conversion.data : null,
      },
    };
  } catch {
    return null;
  }
}

export function saveWorkbench(stored: StoredWorkbench) {
  if (typeof window === "undefined") return;
  const settings = stored.settings.rememberKeys
    ? stored.settings
    : { ...stored.settings, llmApiKey: "", typesafeApiKey: "" };
  const payload: StoredWorkbench = {
    settings,
    packs: stored.packs.slice(0, 30),
    draft: stored.draft,
  };
  if (JSON.stringify(payload.draft).length > 500_000) {
    payload.draft = emptyDraft;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
