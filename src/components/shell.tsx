"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tools } from "@/tools/registry";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 bg-primary px-4 text-primary-foreground max-md:h-auto max-md:flex-wrap max-md:px-3 max-md:py-2">
        <Link href="/" className="flex items-baseline gap-2 no-underline">
          <strong className="font-heading text-xl font-medium tracking-tight">Chat2Jev</strong>
        </Link>
        <nav className="flex flex-wrap gap-1" aria-label="工具">
          {tools.map((tool) => {
            const active = tool.href === "/" ? pathname === "/" : pathname.startsWith(tool.href);
            const Icon = tool.icon;
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
                {tool.label}
                {tool.status === "planned" ? <em className="text-[11px] not-italic opacity-70">敬请期待</em> : null}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3">{children}</main>
    </div>
  );
}
