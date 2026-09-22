"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tools } from "@/tools/registry";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="flex h-16 items-center justify-between gap-6 bg-primary px-7 text-primary-foreground max-md:h-auto max-md:flex-col max-md:items-start max-md:px-5 max-md:py-4">
        <Link href="/" className="flex items-baseline gap-2.5 no-underline">
          <strong className="font-heading text-[26px] font-medium tracking-tight">Chat2Jev</strong>
        </Link>
        <nav className="flex flex-wrap gap-1.5" aria-label="工具">
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
      <main className="mx-auto w-[min(1440px,calc(100%-40px))] pb-28 pt-[18px] max-md:w-[min(100%-28px,1280px)]">{children}</main>
    </>
  );
}
