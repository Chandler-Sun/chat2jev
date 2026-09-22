import assert from "node:assert/strict";
import test from "node:test";
import { extractRequestPayload, normalizeRequest } from "./openai-request";
import { promptFingerprint, skeletonize, slugFromModel, systemText } from "./proxy/slug";
import { assembleState, extractLabeled } from "./proxy/state-map";
import { compactAnswers, synthesizeChatCompletion } from "./proxy/synthesize";
import { seedRoutes } from "./proxy/seeds";
import { ticketSample, toolsSample } from "./samples";

test("skeleton hash ignores dates, emails and ids", () => {
  const a = skeletonize("You are a clerk. Today is 2026-09-22. User 550e8400-e29b-41d4-a716-446655440000 mailed a@b.com.");
  const b = skeletonize("You are a clerk. Today is 2025-01-01. User 11111111-2222-4333-a444-555555555555 mailed c@d.net.");
  assert.equal(a, b);
});

test("same system prompt skeleton shares a fingerprint", () => {
  const first = normalizeRequest(extractRequestPayload(ticketSample));
  const second = normalizeRequest({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: first.messages[0]?.content },
      { role: "user", content: "另一封完全不同的来信" },
    ],
  });
  assert.equal(
    promptFingerprint({ system: systemText(first.messages), tools: first.tools, responseFormat: first.responseFormat }),
    promptFingerprint({ system: systemText(second.messages), tools: second.tools, responseFormat: second.responseFormat }),
  );
});

test("model jev:slug is parsed", () => {
  assert.equal(slugFromModel("jev:ticket-triage"), "ticket-triage");
  assert.equal(slugFromModel("gpt-4.1-mini"), null);
});

test("labeled user text becomes structured state", () => {
  assert.equal(extractLabeled("客户来信：连接失败。\n退款政策：不退。", "客户来信"), "连接失败。");
  const state = assembleState(
    [
      { role: "system", content: "规则" },
      { role: "user", content: "客户来信：连接失败三天了。\n退款政策：集成故障可退。" },
    ],
    { mode: "object", fields: { message: "label:客户来信", refund_policy: "label:退款政策" } },
  );
  assert.deepEqual(state, {
    message: "连接失败三天了。",
    refund_policy: "集成故障可退。",
  });
});

test("seed ticket fingerprint matches the sample request", () => {
  const normalized = normalizeRequest(extractRequestPayload(ticketSample));
  const hash = promptFingerprint({
    system: systemText(normalized.messages),
    tools: normalized.tools,
    responseFormat: normalized.responseFormat,
  });
  assert.equal(seedRoutes.find((route) => route.slug === "ticket-triage")?.fingerprint, hash);
});

test("seed tool router fingerprint matches the sample request", () => {
  const normalized = normalizeRequest(extractRequestPayload(toolsSample));
  const hash = promptFingerprint({
    system: systemText(normalized.messages),
    tools: normalized.tools,
    responseFormat: normalized.responseFormat,
  });
  assert.equal(seedRoutes.find((route) => route.slug === "tool-router")?.fingerprint, hash);
});

test("answers compact into JSON or a tool call", () => {
  const answers = {
    tool: { type: "choice" as const, choice: "place_order", probabilities: { place_order: 0.9, get_quote: 0.1 }, confidence: 0.8 },
    side: { type: "choice" as const, choice: "buy", probabilities: { buy: 1 }, confidence: 1 },
    urgency: { type: "score" as const, score: 2, legend: { "2": "高" }, probabilities: { "2": 1 }, confidence: 1 },
    refund: { type: "noul" as const, noul: 0.12 },
  };
  assert.deepEqual(compactAnswers(answers), { tool: "place_order", side: "buy", urgency: 2, refund: 0.12 });
  const json = synthesizeChatCompletion({ slug: "ticket-triage", answers, mode: "json" });
  assert.equal(json.choices[0]?.message.content, JSON.stringify(compactAnswers(answers)));
  const tool = synthesizeChatCompletion({ slug: "tool-router", answers, mode: "tool_call", primary: "tool" });
  assert.equal(tool.choices[0]?.finish_reason, "tool_calls");
  assert.equal(tool.choices[0]?.message.tool_calls?.[0]?.function.name, "place_order");
  assert.equal(JSON.parse(tool.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? "{}").side, "buy");
});
