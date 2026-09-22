import type { Answer, SystemOneResponse } from "@/lib/types";

export type SynthesizeMode = "json" | "choice_text" | "tool_call";

export type ChatCompletion = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: "stop" | "tool_calls";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export function compactAnswers(answers: Record<string, Answer>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [id, answer] of Object.entries(answers)) {
    if (answer.type === "noul") out[id] = answer.noul;
    else if (answer.type === "choice") out[id] = answer.choice;
    else out[id] = answer.score;
  }
  return out;
}

export function synthesizeChatCompletion(input: {
  slug: string;
  answers: Record<string, Answer>;
  usage?: SystemOneResponse["usage"];
  mode?: SynthesizeMode;
  primary?: string;
}): ChatCompletion {
  const compact = compactAnswers(input.answers);
  const mode = input.mode ?? "json";
  const created = Math.floor(Date.now() / 1000);
  const usage = {
    prompt_tokens: input.usage?.input_tokens ?? 0,
    completion_tokens: input.usage?.output_tokens ?? 0,
    total_tokens: (input.usage?.input_tokens ?? 0) + (input.usage?.output_tokens ?? 0),
  };

  if (mode === "tool_call") {
    const name = pickChoice(input.answers, input.primary);
    const args = { ...compact };
    if (name && args[input.primary ?? firstChoiceId(input.answers) ?? ""] !== undefined) {
      delete args[input.primary ?? firstChoiceId(input.answers) ?? ""];
    }
    return {
      id: `chatcmpl-jev-${input.slug}`,
      object: "chat.completion",
      created,
      model: `jev:${input.slug}`,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: name
              ? [
                  {
                    id: `call_${input.slug}`,
                    type: "function",
                    function: { name, arguments: JSON.stringify(args) },
                  },
                ]
              : undefined,
          },
          finish_reason: name ? "tool_calls" : "stop",
        },
      ],
      usage,
    };
  }

  const content =
    mode === "choice_text"
      ? String(compact[input.primary ?? firstChoiceId(input.answers) ?? ""] ?? "")
      : JSON.stringify(compact);

  return {
    id: `chatcmpl-jev-${input.slug}`,
    object: "chat.completion",
    created,
    model: `jev:${input.slug}`,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage,
  };
}

function firstChoiceId(answers: Record<string, Answer>): string | undefined {
  return Object.entries(answers).find(([, answer]) => answer.type === "choice")?.[0];
}

function pickChoice(answers: Record<string, Answer>, primary?: string): string | null {
  const answer = (primary && answers[primary]) || Object.values(answers).find((item) => item.type === "choice");
  return answer && answer.type === "choice" ? answer.choice : null;
}
