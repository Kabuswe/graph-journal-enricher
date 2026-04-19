/**
 * embeddings.ts — Local embeddings using @xenova/transformers.
 * Downloads Xenova/all-MiniLM-L6-v2 (~30MB) on first use, cached in ~/.cache/huggingface/.
 */
let pipeline: ((texts: string[], options?: Record<string, unknown>) => Promise<unknown[]>) | null = null;

async function getEmbeddingPipeline() {
  if (pipeline) return pipeline;

  const { pipeline: p } = await import("@xenova/transformers") as {
    pipeline: (task: string, model: string) => Promise<(texts: string[], options?: Record<string, unknown>) => Promise<unknown[]>>
  };
  pipeline = await p("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return pipeline;
}

export async function embedText(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe([text], { pooling: "mean", normalize: true });
  const first = output[0] as { data: Float32Array } | Float32Array | number[];
  if ("data" in first) return Array.from((first as { data: Float32Array }).data);
  if (first instanceof Float32Array) return Array.from(first);
  return first as number[];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText));
}
