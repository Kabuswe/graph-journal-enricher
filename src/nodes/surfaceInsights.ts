/**
 * surfaceInsights — extracts core questions, realizations, and open loops.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { fastModel } from "../models.js";

const InsightSchema = z.object({
  coreQuestions: z.array(z.string()).describe("Questions the author is grappling with or exploring"),
  realization: z.string().describe("The central insight or aha-moment of this entry (one sentence)"),
  openLoops: z.array(z.string()).describe("Unfinished thoughts, deferred decisions, or recurring unresolved items"),
});

const structuredModel = fastModel.withStructuredOutput(InsightSchema, {
  method: "jsonSchema",
  strict: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const surfaceInsightsNode = async (state: any) => {
  const { bodyText, dominantThemes, tension } = state;
  const text: string = bodyText ?? "";

  const context = [
    dominantThemes?.length > 0 ? `Themes: ${(dominantThemes as string[]).join(", ")}` : "",
    tension?.length > 0 ? `Tensions: ${(tension as string[]).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const result = await structuredModel.invoke([
    new SystemMessage(
      "Extract the intellectual and reflective content of this journal entry.\n" +
      "coreQuestions: literal or implied questions the author is wrestling with.\n" +
      "realization: the most important insight or conclusion reached (if any) — empty string if none.\n" +
      "openLoops: things the author mentioned but left unresolved, deferred, or unfinished.",
    ),
    new HumanMessage(`${context}\n\nEntry:\n${text.slice(0, 3000)}`),
  ]);

  return {
    phase: "surface-insights",
    coreQuestions: result.coreQuestions,
    realization: result.realization,
    openLoops: result.openLoops,
  };
};
