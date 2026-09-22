import { chatCompletionsUrl, HttpError, readUpstreamError } from "./http";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type CompleteOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
};

export async function completeChat(options: CompleteOptions): Promise<{ content: string; usage?: ChatUsage }> {
  const url = chatCompletionsUrl(options.baseUrl);
  const attempts: Record<string, unknown>[] = [
    {
      model: options.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: options.messages,
    },
    {
      model: options.model,
      messages: options.messages,
    },
  ];

  let lastStatus = 502;
  let lastMessage = "模型服务没有返回内容";

  for (const [index, body] of attempts.entries()) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: ChatUsage;
      };
      const content = messageText(payload.choices?.[0]?.message?.content);
      if (!content.trim()) {
        throw new HttpError(502, "模型返回了空内容");
      }
      return { content, usage: payload.usage };
    }

    lastStatus = response.status;
    lastMessage = await readUpstreamError(response);
    const retryableShape = response.status === 400 || response.status === 422;
    if (!retryableShape || index === attempts.length - 1) {
      throw new HttpError(response.status, lastMessage);
    }
  }

  throw new HttpError(lastStatus, lastMessage);
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}
