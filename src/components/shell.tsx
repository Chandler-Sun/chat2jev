"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/locale-provider";
import { LocaleToggle } from "@/components/locale-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tools } from "@/tools/registry";

const toolLabel = {
  convert: "nav.compare",
  proxy: "nav.proxy",
  ideas: "nav.ideas",
} as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 bg-primary px-4 text-primary-foreground max-md:h-auto max-md:flex-wrap max-md:px-3 max-md:py-2">
        <Link href="/" className="flex items-baseline gap-2 no-underline">
          <strong className="font-heading text-xl font-medium tracking-tight">Chat2Jev</strong>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <nav className="flex flex-wrap gap-1" aria-label={t("nav.tools")}>
            {tools.map((tool) => {
              const active = tool.href === "/" ? pathname === "/" : pathname.startsWith(tool.href);
              const Icon = tool.icon;
              const label = t(toolLabel[tool.id as keyof typeof toolLabel] ?? "nav.compare");
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
                    !active && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                  )}
                >
                  <Icon data-icon="inline-start" />
                  {label}
                  {tool.status === "planned" ? <em className="text-[11px] not-italic opacity-70">{t("nav.soon")}</em> : null}
                </Link>
              );
            })}
          </nav>
          <LocaleToggle />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3">{children}</main>
    </div>
  );
}
