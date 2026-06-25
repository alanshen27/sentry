import OpenAI from "openai";

export type LlmProvider = "openai" | "openrouter";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

export function getLlmConfig(): LlmConfig | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    };
  }
  return null;
}

function createClient(cfg: LlmConfig): OpenAI {
  if (cfg.provider === "openrouter") {
    return new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://sentry.app",
        "X-Title": "Sentry",
      },
    });
  }
  return new OpenAI({ apiKey: cfg.apiKey });
}

export async function llmComplete(system: string, user: string, opts?: { maxTokens?: number }): Promise<string> {
  const cfg = getLlmConfig();
  if (!cfg) throw new Error("no-llm-key");

  const client = createClient(cfg);
  const res = await client.chat.completions.create({
    model: cfg.model,
    max_tokens: opts?.maxTokens ?? 1400,
    temperature: 0.3,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  return res.choices[0]?.message?.content ?? "";
}
