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
  hideContent = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  tone?: WorkspaceTone;
  className?: string;
  contentClassName?: string;
  hideContent?: boolean;
}) {
  return (
    <Card size="sm" data-tone={tone} className={cn("h-full min-h-0 gap-0 py-0", className)}>
      <CardHeader className="shrink-0 rounded-none border-b py-2.5">
        <CardTitle className="flex items-center gap-2">
          {tone ? <span className="tone-dot" aria-hidden="true" /> : null}
          {title}
        </CardTitle>
        {description && !hideContent ? <CardDescription className="panel-desc">{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      {hideContent ? null : (
        <CardContent className={cn("flex min-h-0 flex-1 flex-col overflow-auto py-3", contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
