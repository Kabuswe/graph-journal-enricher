/**
 * scoreMood — LLM mood and energy scoring of the journal entry.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { fastModel } from "../models.js";

const MoodSchema = z.object({
  moodScore: z.number().min(-1).max(1).describe("Valence: -1 very negative, 0 neutral, +1 very positive"),
  energyLevel: z.enum(["low", "medium", "high"]).describe("Activation/energy level of the writing"),
  emotionalArc: z.enum(["ascending", "descending", "flat", "turbulent"]).describe("How mood evolves through the entry"),
  tension: z.array(z.string()).describe("Unresolved conflicts, dilemmas, or sources of stress mentioned"),
  primaryEmotion: z.string().describe("The most prominent single emotion"),
});

const structuredModel = fastModel.withStructuredOutput(MoodSchema, {
  method: "jsonSchema",
  strict: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scoreMoodNode = async (state: any) => {
  const { bodyText } = state;
  const text: string = bodyText ?? "";

  const result = await structuredModel.invoke([
    new SystemMessage(
      "Analyze the emotional content of this journal entry.\n" +
      "moodScore: overall valence (-1 to +1).\n" +
      "energyLevel: how activated/energized the writing feels.\n" +
      "emotionalArc: ascending=gets more positive, descending=gets more negative, turbulent=fluctuates, flat=consistent.\n" +
      "tension: specific unresolved conflicts, fears, or dilemmas explicitly mentioned.",
    ),
    new HumanMessage(text.slice(0, 2500)),
  ]);

  return {
    phase: "score-mood",
    moodScore: result.moodScore,
    energyLevel: result.energyLevel,
    emotionalArc: result.emotionalArc,
    tension: result.tension,
  };
};
