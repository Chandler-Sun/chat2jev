import assert from "node:assert/strict";
import test from "node:test";
import { blankReplaceableState, finalizeConversion, parseModelJson } from "./conversion";
import { chatCompletionsUrl, HttpError } from "./http";
import { extractRequestPayload, normalizeRequest } from "./openai-request";
import { samples } from "./samples";
import { conversionSchema } from "./types";

test("chat completions url keeps an existing v1 prefix", () => {
  assert.equal(
    chatCompletionsUrl("https://api.openai.com/v1"),
    "https://api.openai.com/v1/chat/completions",
  );
  assert.equal(
    chatCompletionsUrl("http://127.0.0.1:11434/v1/"),
    "http://127.0.0.1:11434/v1/chat/completions",
  );
  assert.equal(
    chatCompletionsUrl("https://example.com/openai/v1/chat/completions"),
    "https://example.com/openai/v1/chat/completions",
  );
});

test("metadata addresses are rejected", () => {
  assert.throws(() => chatCompletionsUrl("http://169.254.169.254/latest"), HttpError);
});

test("curl body is extracted and secrets on keys are dropped", () => {
  const payload = extractRequestPayload(`
    curl https://api.openai.com/v1/chat/completions \\
      -H "Authorization: Bearer sk-test" \\
      -d '{"model":"gpt-4.1-mini","api_key":"sk-ignore","messages":[{"role":"user","content":"hello"}]}'
  `);
  const normalized = normalizeRequest(payload);
  assert.equal(normalized.model, "gpt-4.1-mini");
  assert.equal(normalized.messages[0]?.content, "hello");
  assert.equal(JSON.stringify(payload).includes("sk-ignore"), false);
});

test("image parts are skipped with a note", () => {
  const normalized = normalizeRequest({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "看这张图" },
          { type: "image_url", image_url: { url: "https://example.com/a.png" } },
        ],
      },
    ],
  });
  assert.equal(normalized.messages[0]?.content, "看这张图");
  assert.equal(normalized.notes.length, 1);
});

test("sample conversions match the question schema", () => {
  for (const sample of samples) {
    const parsed = conversionSchema.safeParse(sample.preview);
    assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
    assert.doesNotThrow(() => JSON.parse(sample.source));
  }
});

test("replaceable fields can be blanked without touching the question set", () => {
  const ticket = samples[0].preview;
  const blank = blankReplaceableState(ticket.state, ticket.fields);
  assert.deepEqual(blank, { message: "", refund_policy: "" });
  assert.equal(JSON.stringify(ticket.questions).includes("`message`"), true);
});

test("instance text copied into a question is flagged", () => {
  const conversion = finalizeConversion({
    title: "泄漏",
    summary: "",
    fit: "judgment",
    warnings: [],
    state: { review: "这家店的牛肉面实在太咸了，我不会再来，也不会推荐。" },
    fields: [{ path: "review", label: "评论", replaceable: true, description: "原文" }],
    questions: {
      sentiment: {
        type: "choice",
        instructions: "这家店的牛肉面实在太咸了，我不会再来，也不会推荐。是正面还是负面？",
        criteria: { positive: "正面", negative: "负面" },
      },
    },
    questionNotes: [],
  });
  assert.equal(conversion.warnings.some((warning) => warning.includes("实例原文")), true);
});

test("fenced model output parses", () => {
  const parsed = parseModelJson("```json\n{\"title\":\"ok\"}\n```");
  assert.deepEqual(parsed, { title: "ok" });
});
