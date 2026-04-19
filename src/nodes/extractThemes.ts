/**
 * extractThemes — LLM extraction of dominant themes, keywords, and recurring patterns.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { fastModel } from "../models.js";

const ThemeSchema = z.object({
  dominantThemes: z.array(z.string()).min(1).max(5),
  keywords: z.array(z.string()).min(3).max(15),
  recurringThemes: z.array(z.string()).describe("Themes that match existingThemes list (empty if no overlap)"),
});

const structuredModel = fastModel.withStructuredOutput(ThemeSchema, {
  method: "jsonSchema",
  strict: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractThemesNode = async (state: any) => {
  const { bodyText, existingThemes, wordCount } = state;
  const text: string = bodyText ?? "";

  if (wordCount < 30) {
    return {
      phase: "extract-themes",
      dominantThemes: ["brief-entry"],
      keywords: [],
      recurringThemes: [],
    };
  }

  const existingContext = existingThemes?.length > 0
    ? `\nPreviously recurring themes (check for overlap): ${(existingThemes as string[]).join(", ")}`
    : "";

  const result = await structuredModel.invoke([
    new SystemMessage(
      "Extract thematic content from this personal journal entry.\n" +
      "dominantThemes: 1-5 broad themes this entry is about (e.g., 'career anxiety', 'creative growth', 'relationships').\n" +
      "keywords: specific important words/phrases (names, projects, emotions, activities).\n" +
      "recurringThemes: any dominantThemes that also appear in the existing themes list.\n" +
      existingContext,
    ),
    new HumanMessage(text.slice(0, 3000)),
  ]);

  return {
    phase: "extract-themes",
    dominantThemes: result.dominantThemes,
    keywords: result.keywords,
    recurringThemes: result.recurringThemes,
  };
};
