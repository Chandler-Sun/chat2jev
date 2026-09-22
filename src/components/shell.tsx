"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tools } from "@/tools/registry";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          <strong>Jev Lab</strong>
          <span>工作台</span>
        </Link>
        <nav className="nav" aria-label="工具">
          {tools.map((tool) => {
            const active = tool.href === "/" ? pathname === "/" : pathname.startsWith(tool.href);
            return (
              <Link key={tool.id} href={tool.href} data-active={active} aria-current={active ? "page" : undefined}>
                {tool.label}
                {tool.status === "planned" ? <em>即将</em> : null}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
