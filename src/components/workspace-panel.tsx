import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WorkspaceTone = "source" | "state" | "questions" | "results" | "routes" | "inspect";

export function WorkspacePanel({
  title,
  description,
  action,
  children,
  tone,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: WorkspaceTone;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card size="sm" data-tone={tone} className={cn("h-full min-h-0 gap-2 py-2", className)}>
      <CardHeader className="shrink-0 border-b pb-2">
        <CardTitle className="flex items-center gap-2">
          {tone ? <span className="tone-dot" aria-hidden="true" /> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription className="line-clamp-2">{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("flex min-h-0 flex-1 flex-col overflow-auto", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
