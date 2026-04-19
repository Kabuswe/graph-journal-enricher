/**
 * generatePublicRewrite — creates a shareable, anonymized version of the journal entry.
 * Strips personal details, elevates universal themes.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { creativeModel } from "../models.js";

const RewriteSchema = z.object({
  insightSummary: z.string().describe("2-3 sentence insight summary, reflective and universal"),
  publicRewrite: z.string().describe("200-400 word anonymized public version of the entry"),
  title: z.string().max(80).describe("Evocative title for the public version"),
});

const structuredModel = creativeModel.withStructuredOutput(RewriteSchema, {
  method: "jsonSchema",
  strict: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generatePublicRewriteNode = async (state: any) => {
  const { bodyText, dominantThemes, moodScore, realization, season, entryDate } = state;
  const text: string = bodyText ?? "";

  const context = [
    dominantThemes?.length > 0 ? `Themes: ${(dominantThemes as string[]).join(", ")}` : "",
    realization ? `Core realization: ${realization}` : "",
    `Mood: ${moodScore >= 0.3 ? "positive" : moodScore <= -0.3 ? "negative" : "neutral"}`,
    season ? `Season: ${season}` : "",
    entryDate ? `Date: ${entryDate}` : "",
  ].filter(Boolean).join("\n");

  const result = await structuredModel.invoke([
    new SystemMessage(
      "Transform this personal journal entry into a shareable public post.\n" +
      "Rules:\n" +
      "- Remove all personally identifying information (names, specific locations, organizations)\n" +
      "- Keep the emotional truth and universal themes\n" +
      "- Write in first person, present the insights as universally relatable\n" +
      "- The title should be evocative and specific, not generic (avoid 'Reflections on...')\n" +
      "- insightSummary should work as a preview snippet",
    ),
    new HumanMessage(`Context:\n${context}\n\nOriginal entry:\n${text.slice(0, 3000)}`),
  ]);

  return {
    phase: "generate-rewrite",
    insightSummary: result.insightSummary,
    publicRewrite: result.publicRewrite,
    title: result.title,
  };
};
