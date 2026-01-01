// src/routes/api/private/ai/create-media-prompts/+server.ts
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

// If you already have these constants, import them.
// Otherwise, you can remove/replace them.
import { CreateMediaPromptsInputSchema, LogicalChunkSchema } from '$src/lib/zod/ai';

const openai = new OpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

type LogicalChunk = z.infer<typeof LogicalChunkSchema>;

type ModelRoute = 'TECHNICAL' | 'NARRATIVE' | 'ARTISTIC';

type EnrichedLogicalChunk = LogicalChunk & {
  chunkIndex: number;
  prompt: string;         // the actual prompt text you send to an image model
  promptType: ModelRoute; // which model/style bucket
};

export async function POST({ request }: RequestEvent) {
	try {
		const body = await request.json().catch(() => null);

		const parsed = CreateMediaPromptsInputSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{
					success: false,
					error: 'Invalid request',
					message: 'Expected JSON body: { chunks: LogicalChunk[] }'
				},
				{ status: 400 }
			);
		}

		const chunks = parsed.data.chunks;

		// Build a compact payload for the model.
		// Prefer `text`, fall back to summary/title if needed.
		const chunkPayload = chunks.map((c, i) => ({
			index: i,
			title: c.title ?? '',
			summary: c.summary ?? '',
			text: c.text ?? '',
			segmentStart: c.segmentStart ?? null,
			segmentEnd: c.segmentEnd ?? null
		}));

		const userPrompt = `
You are a Creative Director for a podcast visualizer. Analyze the transcript chunks and generate an image prompt and a model routing tag for each.

Model Strengths (Route accordingly):
1. TECHNICAL (OpenAI gpt-image-1): data, UI, grids, labeled diagrams. Clean vector, crisp typography.
2. NARRATIVE (Gemini gemini-2.5-flash-image): metaphors, human scenes, world-building, illustrative storytelling.
3. ARTISTIC (FLUX.2 Pro): cinematic, atmospheric, textured, surreal/abstract compositions.

Rules:
- Prompt: 2-3 descriptive sentences.
- Typography (MANDATORY):
  - Provide 0–4 short labels in labels[] (1–2 words each, prefer ALL CAPS).
  - Do NOT include the string "TEXT_TO_RENDER_EXACTLY" anywhere in the text field.
  - Do NOT use placeholders like "Label1", "Label2".
  - If labels are not needed, return labels: [] and rely on icons/arrows instead.
- Materiality: Mention textures (glass, steel, velvet).

Chunks: ${JSON.stringify(chunkPayload)}`.trim();
		

		const OutputSchema = z.object({
			prompts: z.array(
			z.object({
				text: z.string().min(1),
				type: z.enum(['TECHNICAL', 'NARRATIVE', 'ARTISTIC']),
				labels: z.array(z.string().min(1)).max(4).optional().default([])
			})
			).length(chunks.length)
		});

		const resp = await openai.responses.parse({
			model: 'gpt-5-mini',
			input: [
				{
					role: 'system',
					content:
						'You are a visual orchestrator. Categorize and prompt based on transcript content.' //'You write image-generation prompts. Return ONLY structured data that matches the schema.'
				},
				{ role: 'user', content: userPrompt }
			],
			reasoning: { effort: 'medium' },
			text: {
				format: zodTextFormat(OutputSchema, 'media_prompts')
			},
			store: false
		});

		const parsedOutput = resp.output_parsed; // typed + validated by Zod
		const prompts = parsedOutput?.prompts ?? [];

		// Safety check: schema enforces exact length, but keep a guard anyway.
		if (!Array.isArray(prompts) || prompts.length !== chunks.length) {
			return json(
				{
					success: false,
					error: 'Model output mismatch',
					message: `Expected ${chunks.length} prompts, got ${prompts?.length ?? 0}`
				},
				{ status: 502 }
			);
		}

		const enrichedChunks: EnrichedLogicalChunk[] = chunks.map((chunk, i) => {
			const p = prompts[i] ?? { text: '', type: 'NARRATIVE' as const, labels: [] as string[] };

			const labels = p.labels ?? [];

			const cleanedLabels = labels
			.map(l => l.trim())
			.filter(Boolean)
			.slice(0, 4);

			const textLine = cleanedLabels.length
			? `\nTEXT_TO_RENDER_EXACTLY: ${cleanedLabels.map(l => `"${l}"`).join(' | ')}`
			: '';

			const finalPrompt = `${p.text}${textLine}`.trim();
			return {
				...chunk,
				chunkIndex: i,
				prompt: finalPrompt || 'Simple clean vector diagram, no text.',
				promptType: p.type
			};
		});

		return json({
			success: true,
			enrichedChunks
		});
	} catch (err) {
		console.error('Error in create-media-prompts:', err);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
}
