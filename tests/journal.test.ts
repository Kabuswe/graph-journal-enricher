/**
 * tests/journal.test.ts — integration test for graph-journal-enricher
 */
import "dotenv/config";
import { graph } from "../src/graph.js";

const TEST_CASES = [
  {
    name: "reflective journal entry",
    input: {
      rawContent: `# 2024-06-10 — A Quiet Monday

Spent the morning coding and felt surprisingly focused for once.
The new state management approach in LangGraph is clicking — I finally understand why the
channel model is better than just storing everything in a single object.

Had coffee with Maya. We talked about momentum vs discipline. She made a point I keep
returning to: "You don't rise to your goals, you fall to your systems."

Feeling cautiously optimistic about the week. The tech debt is real but manageable.
Question I keep asking myself: am I building the right things or just the things I know how to build?`,
      entryDate: "2024-06-10",
      existingThemes: ["focus", "learning", "systems-thinking"],
    },
    validate: (r: Record<string, unknown>) =>
      Array.isArray(r.dominantThemes) && (r.dominantThemes as unknown[]).length > 0 &&
      typeof r.moodScore === "number" && (r.moodScore as number) > 0 &&
      typeof r.insightSummary === "string" && (r.insightSummary as string).length > 20 &&
      typeof r.publicRewrite === "string" && (r.publicRewrite as string).length > 20,
  },
  {
    name: "short high-energy entry",
    input: {
      rawContent: `# 2024-06-11

Shipped the connector orchestrator! Tests pass, telemetry works, credits deducted.
Two weeks of grinding finally paid off.
Feeling electric. Beer tonight.`,
      entryDate: "2024-06-11",
      existingThemes: [],
    },
    validate: (r: Record<string, unknown>) =>
      Array.isArray(r.dominantThemes) && (r.dominantThemes as unknown[]).length > 0 &&
      (r.energyLevel === "high" || r.moodScore as number >= 7) &&
      typeof r.publicRewrite === "string" && (r.publicRewrite as string).length > 10,
  },
];

async function runTest(tc: (typeof TEST_CASES)[0]) {
  const config = { configurable: { thread_id: `test-${Date.now()}` } };
  const result = await graph.invoke(tc.input, config);

  const valid = tc.validate(result as Record<string, unknown>);
  const icon = valid ? "✅" : "⚠️";
  console.log(
    `${icon} [${tc.name}] mood=${result.moodScore} energy=${result.energyLevel} themes=${(result.dominantThemes as unknown[])?.length ?? 0}`,
  );
  console.log(`   title: ${result.title}`);
  console.log(`   insight: ${(result.insightSummary as string)?.slice(0, 120)}...`);
  if (!valid) {
    console.log(`   FAIL — got:`, JSON.stringify(result, null, 2).slice(0, 500));
  }
  return valid;
}

async function main() {
  console.log("\n=== graph-journal-enricher integration tests ===\n");
  const results = await Promise.all(TEST_CASES.map(runTest));
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed < results.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
