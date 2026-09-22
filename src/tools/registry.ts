/**
 * Tool catalog for Chat2Jev.
 * To add another Jev tool: append an entry here and create its route.
 */
import type { LucideIcon } from "lucide-react";
import { LightbulbIcon, ScaleIcon, WaypointsIcon } from "lucide-react";

export type ToolStatus = "ready" | "planned";

export type ToolDefinition = {
  id: string;
  href: string;
  label: string;
  description: string;
  status: ToolStatus;
  icon: LucideIcon;
};

export const tools: ToolDefinition[] = [
  {
    id: "convert",
    href: "/",
    label: "对比",
    description: "对照同一段请求的传统 chat completion 和 Jev 判断结果。",
    status: "ready",
    icon: ScaleIcon,
  },
  {
    id: "proxy",
    href: "/proxy",
    label: "代理",
    description: "把 chat completions 自动识别并转成 System One 请求。",
    status: "ready",
    icon: WaypointsIcon,
  },
  {
    id: "ideas",
    href: "/ideas",
    label: "Idea 广场",
    description: "收集、比较和筛选想法。",
    status: "planned",
    icon: LightbulbIcon,
  },
];

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id);
}
