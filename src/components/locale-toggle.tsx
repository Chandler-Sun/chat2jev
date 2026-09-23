"use client";

import { useI18n } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export function LocaleToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="locale-toggle" role="group" aria-label={t("nav.lang")}>
      <button
        type="button"
        className={cn("locale-toggle-btn", locale === "zh" && "is-active")}
        aria-pressed={locale === "zh"}
        onClick={() => setLocale("zh")}
      >
        {t("nav.langZh")}
      </button>
      <button
        type="button"
        className={cn("locale-toggle-btn", locale === "en" && "is-active")}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
