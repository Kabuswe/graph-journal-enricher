/**
 * tests/journal.test.ts -- vitest integration tests for graph-journal-enricher.
 * Makes real LLM calls via OpenRouter -- requires OPENROUTER_API_KEY in .env.
 */
import "dotenv/config";
import { describe, test, expect } from "vitest";
import { graph } from "../src/graph.js";

describe("graph-journal-enricher", () => {
  test("extracts themes, scores mood, and generates public rewrite from reflective entry", async () => {
    const result = await graph.invoke(
      {
        rawContent: [
          "---",
          "date: 2026-04-20",
          "mood: 7",
          "tags: [reflection, growth, learning]",
          "---",
          "",
          "# A Day of Deep Work",
          "",
          "Today I spent six uninterrupted hours working through a complex distributed systems problem.",
          "The focus was profound -- I noticed how much clearer my thinking becomes when I eliminate distractions.",
          "",
          "There is something deeply satisfying about understanding a system end-to-end.",
          "I kept asking myself: what would it take for this to fail? That adversarial mindset led to three key insights.",
          "",
          "I realise now that I have been avoiding the hardest problems, not because I cannot solve them,",
          "but because I fear how much time they will consume. That fear is worth examining.",
          "",
          "Tomorrow: tackle the concurrency issue head-on. No avoidance.",
        ].join("\n"),
        clientId: "test",
      },
      { configurable: { thread_id: "test-journal-1-" + Date.now() } },
    );
    expect(result.phase).toBe("embed-store");
    expect(Array.isArray(result.dominantThemes)).toBe(true);
    expect((result.dominantThemes as unknown[]).length).toBeGreaterThan(0);
    expect(typeof result.moodScore).toBe("number");
    expect(result.moodScore as number).toBeGreaterThan(-1);
    expect(result.moodScore as number).toBeLessThanOrEqual(1);
    expect(typeof result.insightSummary).toBe("string");
    expect((result.insightSummary as string).length).toBeGreaterThan(20);
    expect(typeof result.publicRewrite).toBe("string");
    expect((result.publicRewrite as string).length).toBeGreaterThan(20);
    expect(result.vectorId).toBeTruthy();
    expect(result.storedAt).toBeTruthy();
  }, 120000);

  test("detects high energy and produces keywords for high-energy entry", async () => {
    const result = await graph.invoke(
      {
        rawContent: [
          "---",
          "date: 2026-04-20",
          "energy: high",
          "---",
          "",
          "# Breakthrough Day",
          "",
          "Everything clicked today. Shipped three features, pair-programmed with an amazing engineer,",
          "and got positive feedback from the entire team.",
          "",
          "I feel unstoppable. The architecture we designed is elegant and performant.",
          "Benchmarks show a 40% latency reduction over the previous approach.",
          "",
          "I want to keep this momentum. Tomorrow I will start on the authentication layer.",
          "The enthusiasm I feel right now is the fuel I need to tackle the hard parts.",
        ].join("\n"),
        clientId: "test",
      },
      { configurable: { thread_id: "test-journal-2-" + Date.now() } },
    );
    expect(result.phase).toBe("embed-store");
    expect(Array.isArray(result.dominantThemes)).toBe(true);
    expect((result.dominantThemes as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(result.keywords)).toBe(true);
    expect((result.keywords as string[]).length).toBeGreaterThan(0);
    expect(result.energyLevel).toBe("high");
    expect(typeof result.publicRewrite).toBe("string");
    expect((result.publicRewrite as string).length).toBeGreaterThan(10);
    expect(result.vectorId).toBeTruthy();
  }, 120000);

  test("identifies tension and core questions in a conflicted entry", async () => {
    const result = await graph.invoke(
      {
        rawContent: [
          "---",
          "date: 2026-04-20",
          "---",
          "",
          "# Doubts",
          "",
          "Am I working on the right things? I spent the whole day in meetings that could have been emails.",
          "I did not write a single line of code. I feel like I am drifting from what I actually care about.",
          "",
          "My manager says leadership is the next step. But is that what I want?",
          "The tension between impact and craft is real. I do not have answers yet.",
        ].join("\n"),
        clientId: "test",
      },
      { configurable: { thread_id: "test-journal-3-" + Date.now() } },
    );
    expect(result.phase).toBe("embed-store");
    expect(Array.isArray(result.dominantThemes)).toBe(true);
    expect(typeof result.moodScore).toBe("number");
    expect(Array.isArray(result.coreQuestions)).toBe(true);
    expect((result.coreQuestions as string[]).length).toBeGreaterThan(0);
    expect(typeof result.publicRewrite).toBe("string");
    expect((result.publicRewrite as string).length).toBeGreaterThan(10);
  }, 120000);
});
