"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  detectLocale,
  readStoredLocale,
  translate,
  writeStoredLocale,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

let current: Locale = "zh";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.locale = locale;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(subscribe, () => current, (): Locale => "zh");

  useEffect(() => {
    current = readStoredLocale() ?? detectLocale();
    applyDocumentLocale(current);
    emit();
  }, []);

  const setLocale = useCallback((next: Locale) => {
    current = next;
    writeStoredLocale(next);
    applyDocumentLocale(next);
    emit();
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function getLocale(): Locale {
  return current;
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) {
    return {
      locale: "zh" as const,
      setLocale: () => undefined,
      t: (key: MessageKey, vars?: Record<string, string | number>) => translate("zh", key, vars),
    };
  }
  return value;
}
