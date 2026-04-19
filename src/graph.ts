/**
 * graph-journal-enricher
 *
 * Pipeline: parseMarkdown → extractThemes → scoreMood → surfaceInsights → generatePublicRewrite → embedAndStore
 *
 * Input:  JournalEnricherInput  (rawContent, entryDate, existingThemes[])
 * Output: JournalEnricherOutput (dominantThemes, moodScore, energyLevel, coreQuestions[], insightSummary, publicRewrite, title, vectorId)
 *
 * TODO: implement nodes under src/nodes/ per PRD.md
 * TODO: implement src/seed.ts batch script for existing vault entries
 */

import { StateGraph, START, END, MemorySaver, StateSchema, UntrackedValue } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';
import { z } from 'zod';

function lastValue<T>(schema: z.ZodType<T, any, any>): UntrackedValue<T> {
  return schema as unknown as UntrackedValue<T>;
}

const JournalState = new StateSchema({
  rawContent:        lastValue(z.string().default('')),
  entryDate:         lastValue(z.string().default('')),
  existingThemes:    lastValue(z.array(z.string()).default(() => [])),
  bodyText:          lastValue(z.string().default('')),
  wordCount:         lastValue(z.number().default(0)),
  structuralSignals: lastValue(z.any().default(() => ({}))),
  dominantThemes:    lastValue(z.array(z.string()).default(() => [])),
  keywords:          lastValue(z.array(z.string()).default(() => [])),
  recurringThemes:   lastValue(z.array(z.string()).default(() => [])),
  season:            lastValue(z.string().default('')),
  moodScore:         lastValue(z.number().default(0)),
  energyLevel:       lastValue(z.enum(['low', 'medium', 'high']).default('medium')),
  emotionalArc:      lastValue(z.enum(['ascending', 'descending', 'flat', 'turbulent']).default('flat')),
  tension:           lastValue(z.array(z.string()).default(() => [])),
  coreQuestions:     lastValue(z.array(z.string()).default(() => [])),
  realization:       lastValue(z.string().default('')),
  openLoops:         lastValue(z.array(z.string()).default(() => [])),
  insightSummary:    lastValue(z.string().default('')),
  publicRewrite:     lastValue(z.string().default('')),
  title:             lastValue(z.string().default('')),
  vectorId:          lastValue(z.string().default('')),
  storedAt:          lastValue(z.string().default('')),
  error:             lastValue(z.string().optional()),
  phase:             lastValue(z.string().default('')),
});

const standardRetry = { maxAttempts: 3, initialInterval: 1000, backoffFactor: 2 };

// TODO: replace stubs with real node implementations
const parseMarkdownNode         = async (s: any) => ({ phase: 'parse-markdown', bodyText: s.rawContent, wordCount: 0, structuralSignals: {}, season: '' });
const extractThemesNode         = async (s: any) => ({ phase: 'extract-themes', dominantThemes: [], keywords: [], recurringThemes: [] });
const scoreMoodNode             = async (s: any) => ({ phase: 'score-mood', moodScore: 0, energyLevel: 'medium' as const, emotionalArc: 'flat' as const, tension: [] });
const surfaceInsightsNode       = async (s: any) => ({ phase: 'surface-insights', coreQuestions: [], realization: '', openLoops: [] });
const generatePublicRewriteNode = async (s: any) => ({ phase: 'generate-rewrite', insightSummary: '', publicRewrite: '', title: '' });
const embedAndStoreNode         = async (s: any) => ({ phase: 'embed-store', vectorId: '', storedAt: new Date().toISOString() });

function assembleGraph(checkpointer?: MemorySaver) {
  const builder = new StateGraph(JournalState)
    .addNode('parseMarkdown',         parseMarkdownNode,         { retryPolicy: standardRetry })
    .addNode('extractThemes',         extractThemesNode,         { retryPolicy: standardRetry })
    .addNode('scoreMood',             scoreMoodNode,             { retryPolicy: standardRetry })
    .addNode('surfaceInsights',       surfaceInsightsNode,       { retryPolicy: standardRetry })
    .addNode('generatePublicRewrite', generatePublicRewriteNode, { retryPolicy: standardRetry })
    .addNode('embedAndStore',         embedAndStoreNode,         { retryPolicy: standardRetry })
    .addEdge(START, 'parseMarkdown')
    .addEdge('parseMarkdown', 'extractThemes')
    .addEdge('extractThemes', 'scoreMood')
    .addEdge('scoreMood', 'surfaceInsights')
    .addEdge('surfaceInsights', 'generatePublicRewrite')
    .addEdge('generatePublicRewrite', 'embedAndStore')
    .addEdge('embedAndStore', END);

  return checkpointer ? builder.compile({ checkpointer }) : builder.compile();
}

export const graph: any = assembleGraph(new MemorySaver());

export async function buildGraph(): Promise<any> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const checkpointer = new PostgresSaver(pool);
  await checkpointer.setup();
  return assembleGraph(checkpointer as unknown as MemorySaver);
}
