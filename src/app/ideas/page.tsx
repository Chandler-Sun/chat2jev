"use client";

import Link from "next/link";
import { ArrowLeftIcon, LightbulbIcon } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function IdeasPage() {
  const { t } = useI18n();
  return (
    <Empty className="h-full border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LightbulbIcon />
        </EmptyMedia>
        <EmptyTitle>{t("nav.ideas")}</EmptyTitle>
        <EmptyDescription>
          {t("ideas.desc")} {t("ideas.extra")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/" className={buttonVariants()}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t("ideas.back")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
