import { z } from "zod";

const entrySchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

export const noulQuestionSchema = z.object({
  type: z.literal("noul"),
  instructions: entrySchema,
  criteria: z
    .object({
      true: entrySchema.optional(),
      false: entrySchema.optional(),
    })
    .optional(),
});

export const choiceQuestionSchema = z.object({
  type: z.literal("choice"),
  instructions: entrySchema,
  criteria: z.record(z.string(), entrySchema.nullable()).superRefine((criteria, ctx) => {
    const count = Object.keys(criteria).length;
    if (count < 1 || count > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choice 需要 1 到 40 个选项",
      });
    }
  }),
});

export const scoreQuestionSchema = z.object({
  type: z.literal("score"),
  instructions: entrySchema,
  criteria: z.array(entrySchema).min(2).max(10),
});

export const questionSchema = z.discriminatedUnion("type", [
  noulQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

export const questionsSchema = z
  .record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, "问题 id 需要是 snake_case"), questionSchema)
  .superRefine((questions, ctx) => {
    if (Object.keys(questions).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "至少需要一个问题",
      });
    }
  });

export const fieldNoteSchema = z.object({
  path: z.string(),
  label: z.string(),
  replaceable: z.boolean(),
  description: z.string(),
});

export const questionNoteSchema = z.object({
  id: z.string(),
  purpose: z.string(),
});

export const conversionSchema = z.object({
  title: z.string().min(1).default("未命名判断"),
  summary: z.string().default(""),
  fit: z.enum(["judgment", "mixed", "generative"]).default("mixed"),
  warnings: z.array(z.string()).default([]),
  state: z.custom<StateValue>(isStateValue, "State 需要是字符串、对象或数组"),
  fields: z.array(fieldNoteSchema).default([]),
  questions: questionsSchema,
  questionNotes: z.array(questionNoteSchema).default([]),
});

export const stateSchema = z.custom<StateValue>(isStateValue, "State 需要是字符串、对象或数组");

export type Question = z.infer<typeof questionSchema>;
export type Questions = z.infer<typeof questionsSchema>;
export type FieldNote = z.infer<typeof fieldNoteSchema>;
export type QuestionNote = z.infer<typeof questionNoteSchema>;
export type Conversion = z.infer<typeof conversionSchema>;
export type Fit = Conversion["fit"];

export type StateValue = string | Record<string, unknown> | unknown[];

export type NormalizedMessage = {
  role: string;
  content: string;
};

export type NormalizedRequest = {
  model?: string;
  messages: NormalizedMessage[];
  tools?: unknown;
  responseFormat?: unknown;
  notes: string[];
};

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type SystemOneResponse = {
  model?: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function isStateValue(value: unknown): value is StateValue {
  if (typeof value === "string") return true;
  if (Array.isArray(value)) return true;
  return value !== null && typeof value === "object";
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.join(".") || "根";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}
