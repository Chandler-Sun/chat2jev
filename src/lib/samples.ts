import { pretty } from "./conversion";
import type { Locale } from "./i18n";
import type { Conversion, Questions, StateValue } from "./types";

export const ticketSample = `{
  "model": "gpt-4.1-mini",
  "messages": [
    {
      "role": "system",
      "content": "你是客服分诊员。根据客户来信和退款政策，判断该转给哪个部门（billing 账单与退款，technical 故障与集成，sales 价格与升级），客户是否在要求退款，政策是否支持退款，以及不满程度（平静、着急但礼貌、强烈不满）。只输出 JSON。"
    },
    {
      "role": "user",
      "content": "客户来信：我的 Stripe 连接失败三天了，订单一直付不了款，请马上处理。\\n退款政策：因我方集成故障导致的重复扣款可以全额退款。本封来信没有提到重复扣款。"
    }
  ]
}`;

export const ticketSampleEn = `{
  "model": "gpt-4.1-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a support triage agent. Using the customer message and the refund policy, decide which department should handle it (billing for charges and refunds, technical for outages and integrations, sales for pricing and upgrades), whether the customer is asking for a refund, whether the policy supports a refund, and how upset they are (calm, urgent but polite, strongly dissatisfied). Output JSON only."
    },
    {
      "role": "user",
      "content": "Customer message: My Stripe connection has been failing for three days, so orders cannot be paid. Please handle this immediately.\\nRefund policy: Duplicate charges caused by our integration failures can be refunded in full. This message does not mention a duplicate charge."
    }
  ]
}`;

export const toolsSample = `{
  "model": "gpt-4.1-mini",
  "messages": [
    {
      "role": "system",
      "content": "Route the trader's request to a tool. Only use the provided tools."
    },
    {
      "role": "user",
      "content": "Buy 40 shares of AAPL at market."
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "place_order",
        "description": "Place a stock order",
        "parameters": {
          "type": "object",
          "properties": {
            "symbol": { "type": "string" },
            "side": { "type": "string", "enum": ["buy", "sell"] },
            "quantity": { "type": "integer" },
            "order_type": { "type": "string", "enum": ["market", "limit"] }
          },
          "required": ["symbol", "side", "quantity", "order_type"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_quote",
        "description": "Get the latest price",
        "parameters": {
          "type": "object",
          "properties": { "symbol": { "type": "string" } },
          "required": ["symbol"]
        }
      }
    }
  ]
}`;

const ticketStateZh: StateValue = {
  message: "我的 Stripe 连接失败三天了，订单一直付不了款，请马上处理。",
  refund_policy: "因我方集成故障导致的重复扣款可以全额退款。",
};

const ticketStateEn: StateValue = {
  message: "My Stripe connection has been failing for three days, so orders cannot be paid. Please handle this immediately.",
  refund_policy: "Duplicate charges caused by our integration failures can be refunded in full.",
};

const ticketQuestionsZh: Questions = {
  department: {
    type: "choice",
    instructions: "哪个团队应该处理 `message`？",
    criteria: {
      billing: "账单、扣款、退款",
      technical: "故障、集成、连接失败",
      sales: "价格、升级、新购",
      other: "以上都不是",
    },
  },
  refund_requested: {
    type: "noul",
    instructions: "`message` 是否在要求退款？",
    criteria: {
      true: "明确要求把钱退回",
      false: "没有提出退款",
    },
  },
  policy_supports_refund: {
    type: "noul",
    instructions: "给定 `refund_policy`，它是否支持 `message` 里提出的诉求？",
    criteria: {
      true: "政策覆盖来信中的具体情况",
      false: "政策不覆盖，或来信没有提出政策所针对的诉求",
    },
  },
  urgency: {
    type: "score",
    instructions: "`message` 传达出的紧急或不满程度",
    criteria: ["平静陈述，没有时间压力", "着急但仍然礼貌", "强烈不满，或明确要求立刻处理"],
  },
};

const ticketQuestionsEn: Questions = {
  department: {
    type: "choice",
    instructions: "Which team should handle `message`?",
    criteria: {
      billing: "Charges, payments, refunds",
      technical: "Outages, integrations, connection failures",
      sales: "Pricing, upgrades, new purchases",
      other: "None of the above",
    },
  },
  refund_requested: {
    type: "noul",
    instructions: "Is `message` asking for a refund?",
    criteria: {
      true: "An explicit request to get money back",
      false: "No refund is requested",
    },
  },
  policy_supports_refund: {
    type: "noul",
    instructions: "Given `refund_policy`, does it cover the request in `message`?",
    criteria: {
      true: "The policy covers this specific case",
      false: "The policy does not cover it, or the message does not ask for what the policy addresses",
    },
  },
  urgency: {
    type: "score",
    instructions: "How urgent or dissatisfied does `message` sound?",
    criteria: ["Calm statement, no time pressure", "Urgent but still polite", "Strongly dissatisfied, or asking for immediate action"],
  },
};

export const ticketConversion: Conversion = {
  title: "客服来信分诊",
  summary: "部门、退款诉求、政策是否覆盖、不满程度，都是对同一封来信的独立判断。",
  fit: "judgment",
  warnings: [
    "示例转换没有调用模型。Jev 以英文判断最稳，中文样本建议对照置信度再决定是否自动处理。",
  ],
  state: ticketStateZh,
  fields: [
    {
      path: "message",
      label: "来信",
      replaceable: true,
      description: "每次替换的客户原文",
    },
    {
      path: "refund_policy",
      label: "退款政策",
      replaceable: true,
      description: "作为证据核对的政策原文，换一条政策时改这里",
    },
  ],
  questions: ticketQuestionsZh,
  questionNotes: [
    { id: "department", purpose: "选择处理队列" },
    { id: "refund_requested", purpose: "决定要不要进入退款分支" },
    { id: "policy_supports_refund", purpose: "核对政策是否覆盖这封来信" },
    { id: "urgency", purpose: "给排序一个可调的程度" },
  ],
};

export const ticketConversionEn: Conversion = {
  title: "Support ticket triage",
  summary: "Department, refund request, policy coverage, and urgency are independent judgments of the same message.",
  fit: "judgment",
  warnings: [
    "This sample was assembled by hand, not converted by a model.",
  ],
  state: ticketStateEn,
  fields: [
    {
      path: "message",
      label: "Message",
      replaceable: true,
      description: "The customer text to replace each time",
    },
    {
      path: "refund_policy",
      label: "Refund policy",
      replaceable: true,
      description: "The policy used as evidence. Change this when you try another policy.",
    },
  ],
  questions: ticketQuestionsEn,
  questionNotes: [
    { id: "department", purpose: "Pick the handling queue" },
    { id: "refund_requested", purpose: "Decide whether to enter the refund path" },
    { id: "policy_supports_refund", purpose: "Check whether the policy covers this message" },
    { id: "urgency", purpose: "A tunable score for ordering" },
  ],
};

const toolsState: StateValue = {
  utterance: "Buy 40 shares of AAPL at market.",
};

const toolsQuestions: Questions = {
  tool: {
    type: "choice",
    instructions: "Which tool should handle `utterance`?",
    criteria: {
      place_order: "The user wants to buy or sell shares.",
      get_quote: "The user wants a price.",
      none: "No tool applies.",
    },
  },
  side: {
    type: "choice",
    instructions: "If `utterance` is an order, which side is it? Otherwise choose not_applicable.",
    criteria: {
      buy: "Acquire shares.",
      sell: "Dispose of shares.",
      not_applicable: "The utterance is not an order.",
    },
  },
  order_type: {
    type: "choice",
    instructions: "If `utterance` is an order, is it a market or limit order?",
    criteria: {
      market: "Execute at the current market.",
      limit: "Execute only at a stated limit price.",
      not_applicable: "The utterance is not an order.",
    },
  },
};

export const toolsConversion: Conversion = {
  title: "交易指令路由",
  summary: "函数名和封闭参数做成判断。开放字符串留给代码先抽出候选。",
  fit: "mixed",
  warnings: [
    "symbol 和 quantity 是开放字符串，Jev 不会把它们生成出来。先用代码找出候选，再用 Choice 选定。",
    "side 和 order_type 是推测性问题：如果这句话不是下单，代码忽略这两个答案。",
  ],
  state: toolsState,
  fields: [
    {
      path: "utterance",
      label: "交易指令",
      replaceable: true,
      description: "每次替换的自然语言指令",
    },
  ],
  questions: toolsQuestions,
  questionNotes: [
    { id: "tool", purpose: "选择要调用的函数" },
    { id: "side", purpose: "仅在 place_order 时读取" },
    { id: "order_type", purpose: "仅在 place_order 时读取" },
  ],
};

export const toolsConversionEn: Conversion = {
  title: "Trade instruction routing",
  summary: "The function name and closed parameters become judgments. Open strings are left for code to extract first.",
  fit: "mixed",
  warnings: [
    "symbol and quantity are open strings. Jev will not generate them. Extract candidates in code, then pick with Choice.",
    "side and order_type are speculative: if this utterance is not an order, ignore those answers.",
  ],
  state: toolsState,
  fields: [
    {
      path: "utterance",
      label: "Instruction",
      replaceable: true,
      description: "The natural-language command to replace each time",
    },
  ],
  questions: toolsQuestions,
  questionNotes: [
    { id: "tool", purpose: "Pick the function to call" },
    { id: "side", purpose: "Read only for place_order" },
    { id: "order_type", purpose: "Read only for place_order" },
  ],
};

export const sampleIds = ["ticket", "tools"] as const;
export type SampleId = (typeof sampleIds)[number];

export type Sample = {
  id: SampleId;
  source: string;
  preview: Conversion;
};

export const samplesByLocale: Record<Locale, readonly Sample[]> = {
  zh: [
    { id: "ticket", source: ticketSample, preview: ticketConversion },
    { id: "tools", source: toolsSample, preview: toolsConversion },
  ],
  en: [
    { id: "ticket", source: ticketSampleEn, preview: ticketConversionEn },
    { id: "tools", source: toolsSample, preview: toolsConversionEn },
  ],
};

export const samples = samplesByLocale.zh;

export function samplesFor(locale: Locale): readonly Sample[] {
  return samplesByLocale[locale];
}

export function sampleById(locale: Locale, id: string): Sample | undefined {
  return samplesFor(locale).find((sample) => sample.id === id);
}

export function findSampleId(source: string, stateText?: string, questionsText?: string): SampleId | null {
  for (const locale of Object.keys(samplesByLocale) as Locale[]) {
    for (const sample of samplesByLocale[locale]) {
      if (sample.source !== source) continue;
      if (stateText !== undefined && pretty(sample.preview.state) !== stateText) continue;
      if (questionsText !== undefined && pretty(sample.preview.questions) !== questionsText) continue;
      return sample.id;
    }
  }
  return null;
}
