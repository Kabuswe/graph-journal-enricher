import { ChatOpenRouter } from "@langchain/openrouter";

/** Fast structured output: keyword/theme extraction. */
export const fastModel = new ChatOpenRouter({
  model: "openai/gpt-5-mini",
  temperature: 0.1,
  maxRetries: 3,
});

/** Creative writing: public rewrites, insight generation. */
export const creativeModel = new ChatOpenRouter({
  model: "x-ai/grok-4.1-fast",
  temperature: 0.7,
  maxTokens: 4000,
  maxRetries: 3,
});
