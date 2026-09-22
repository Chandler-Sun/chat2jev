/**
 * Tool catalog for the workbench.
 * To add another Jev tool: append an entry here and create its route.
 * Ready tools are the primary navigation; planned tools stay visible
 * so later Jev workflows and the idea board have a place to land.
 */
export type ToolStatus = "ready" | "planned";

export type ToolDefinition = {
  id: string;
  href: string;
  label: string;
  description: string;
  status: ToolStatus;
};

export const tools: ToolDefinition[] = [
  {
    id: "convert",
    href: "/",
    label: "请求转换",
    description: "把 OpenAI 兼容请求拆成可替换的 State 和可复用的 Questions。",
    status: "ready",
  },
  {
    id: "ideas",
    href: "/ideas",
    label: "Idea 广场",
    description: "收集、比较和筛选想法。",
    status: "planned",
  },
];

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id);
}
