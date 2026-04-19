# graph-journal-enricher — Product Requirements Document

## Purpose
Single-purpose remote subgraph that processes raw Obsidian journal markdown entries from the Kabatoshi vault (Random Thoughts series). Extracts themes, scores mood and energy, surfaces implicit questions, generates a distilled insight summary, produces a public-facing rewrite, generates a semantic embedding for indexing, and writes enriched metadata to DynamoDB + S3 Vectors. Triggered nightly by EventBridge for new entries, or on-demand via direct invocation.

## Deployment
- Deployed on LangSmith Deployment as `journalEnricher`
- `langgraph.json`: `{ "graphs": { "journalEnricher": "./src/graph.ts:graph" } }`
- Triggered by EventBridge cron: `rate(1 day)` at 02:00 Casablanca time
- Also callable on-demand from the portfolio admin panel

## Pipeline
```
START → parseMarkdown → extractThemes → scoreMood → surfaceInsights → generatePublicRewrite → embedAndStore → END
```

### Node Responsibilities

**`parseMarkdown`**
- Extract frontmatter (if present), body text, word count, entry date from filename or content
- Detect structural signals: paragraph count, question marks count, ellipsis count (uncertainty markers)
- Output: `bodyText`, `entryDate`, `wordCount`, `structuralSignals`

**`extractThemes`** (fastModel, structured output)
- Identify 2–5 dominant themes from a fixed taxonomy:
  `identity | work | running | relationships | memory | creativity | tools | culture | environment | philosophy`
- Also extract free-form `keywords: string[]` (max 8)
- Cross-reference against `existingThemes[]` passed in — flag recurring themes
- Output: `dominantThemes`, `keywords`, `recurringThemes`

**`scoreMood`** (fastModel, structured output)
- `moodScore: number` — valence from -1.0 (very negative) to 1.0 (very positive)
- `energyLevel: 'low' | 'medium' | 'high'`
- `emotionalArc: 'ascending' | 'descending' | 'flat' | 'turbulent'` — does the entry move toward or away from resolution?
- `tension: string[]` — explicit contradictions or unresolved conflicts identified in the text
- Output: `moodScore`, `energyLevel`, `emotionalArc`, `tension`

**`surfaceInsights`** (reasoningModel)
- Extract `coreQuestions: string[]` — implicit questions the writer is wrestling with (phrased as questions)
- Extract `realization: string` — the most significant thing the writer arrived at, even partially
- Extract `openLoops: string[]` — unresolved threads that may recur in future entries
- Output: `coreQuestions`, `realization`, `openLoops`

**`generatePublicRewrite`** (reasoningModel)
- Produce `insightSummary: string` — 2–3 sentences distilling the entry for display on the portfolio journaling section
- Produce `publicRewrite: string` — 150–200 word essay: strips self-doubt spirals, centers the realization, retains honesty; written in first person
- Produce `title: string` — a question or declarative insight (not the date)
- Rule: must NOT reproduce hedging phrases like “I’m not sure”, “maybe” used defensively, or circular self-criticism without resolution
- Output: `insightSummary`, `publicRewrite`, `title`

**`embedAndStore`**
- Embed `publicRewrite + ' ' + keywords.join(' ')` using Bedrock Titan Embeddings V2
- Write to S3 Vectors with metadata: `{ source: 'vault', entryDate, dominantThemes, moodScore, energyLevel, season }`
- Write enriched entry to DynamoDB `kabatoshi-journal` table
- Update Amplify DataStore `Thought` model with `insightSummary`, `publicRewrite`, `title`, and tag fields
- Output: `vectorId`, `storedAt`

## Season Derivation
Derive `season` from `entryDate` for Northern Hemisphere (Casablanca):
- Dec–1, Jan, Feb → `winter`
- Mar–31 May → `spring`
- Jun–31 Aug → `summer`
- Sep–30 Nov → `autumn`

## State Schema
```ts
{
  rawContent: string;
  entryDate: string;
  existingThemes: string[];

  bodyText: string;
  wordCount: number;
  structuralSignals: { paragraphCount: number; questionCount: number; ellipsisCount: number };

  dominantThemes: string[];
  keywords: string[];
  recurringThemes: string[];
  season: string;

  moodScore: number;
  energyLevel: 'low' | 'medium' | 'high';
  emotionalArc: 'ascending' | 'descending' | 'flat' | 'turbulent';
  tension: string[];

  coreQuestions: string[];
  realization: string;
  openLoops: string[];

  insightSummary: string;
  publicRewrite: string;
  title: string;

  vectorId: string;
  storedAt: string;

  error?: string;
  phase: string;
}
```

## Environment Variables
```
OPENROUTER_API_KEY=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_VECTORS_INDEX_ARN=
DYNAMODB_JOURNAL_TABLE=kabatoshi-journal
AMPLIFY_THOUGHT_API_URL=
AMPLIFY_API_KEY=
LANGSMITH_API_KEY=
LANGSMITH_TRACING_V2=true
LANGSMITH_PROJECT=graph-journal-enricher
DATABASE_URL=
```

## Agent Instructions
1. `generatePublicRewrite` is the most sensitive node — use a system prompt that explicitly instructs the model to act as a thoughtful editor, not a cheerleader; preserve the writer’s voice
2. `scoreMood` must use structured output with strict bounds validation on `moodScore` (-1 to 1)
3. `embedAndStore` must write to ALL three destinations (S3 Vectors, DynamoDB, Amplify) — partial failures should be logged but not abort the graph
4. The `season` field must be computed deterministically in `parseMarkdown` — not by an LLM
5. All entries from the 8 existing Random Thoughts files must be processable as a batch seed — write a `src/seed.ts` script that reads a directory and invokes the graph for each `.md` file
6. `insightSummary` must be ≤ 280 characters (tweet-length) for use in portfolio preview cards
7. Write tests for mood scoring on entries with known valence from the 8 existing entries

## Acceptance Criteria
- April 17th entry (raw low: “feeling defeated, rotating in loops”) scores `moodScore < -0.5`, `emotionalArc: 'flat'`
- April 18th entry (grounded clarity: “done my best work with less than more”) scores `moodScore > 0.2`, `emotionalArc: 'ascending'`
- `publicRewrite` for any entry is 150–200 words and contains no hedging spirals
- `insightSummary` is ≤ 280 characters
- All three storage destinations are written successfully
- Batch seed script processes all 8 existing entries without error
