import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { GenerateTextContextInputSchema } from '$lib/zod/ai';

const openai = new OpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

/**
 * A "context moment" is just a candidate spot in the transcript that
 * would benefit from an extra explanation (generated in a later request).
 */
export type ContextMoment = {
  title: string; // short label, e.g. "Scaling laws"
  triggerQuote: string; // exact quote copied from transcript
  segmentStart?: number | null;
  segmentEnd?: number | null;
  importance: 'low' | 'medium' | 'high';
  visual: 'none' | 'diagram' | 'photo' | 'both';
  visualQuery?: string | null; // short query for later image search
};

// ---------- Model output schema ----------
const ContextMomentSchema = z.object({
  title: z.string().min(2).max(80),
  triggerQuote: z.string().min(5).max(240),
  importance: z.enum(['low', 'medium', 'high']),
  segmentStart: z.number().nullable().optional(),
  segmentEnd: z.number().nullable().optional(),
  visual: z.enum(['none', 'diagram', 'photo', 'both']),
  visualQuery: z.string().min(2).max(80).nullable().optional()
});

const ContextMomentsResponseSchema = z.object({
  moments: z.array(ContextMomentSchema)
});

// ---------- Utility: windowing transcript ----------
function splitIntoWindows(text: string, targetChars = 3500): string[] {
  const parts = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const windows: string[] = [];
  let buf = '';

  for (const p of parts) {
    if ((buf + '\n\n' + p).length > targetChars && buf.length > 0) {
      windows.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }

  if (buf) windows.push(buf);
  return windows;
}

// ---------- Utility: dedupe ----------
function dedupeMoments(moments: ContextMoment[]): ContextMoment[] {
  const seen = new Set<string>();
  const out: ContextMoment[] = [];

  for (const m of moments) {
    const key = `${m.title.toLowerCase()}|${m.triggerQuote.toLowerCase()}`.slice(0, 300);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }

  return out;
}

// ---------- The endpoint ----------
export async function POST({ request }: RequestEvent) {
  try {
    const body = await request.json();
    const parsed = GenerateTextContextInputSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        {
          success: false,
          error: 'Invalid input',
          message: parsed.error.issues.map((i) => i.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { text, maxMomentsPerWindow = 6 } = parsed.data;

    const windows = splitIntoWindows(text, 3500);
    const allMoments: ContextMoment[] = [];

    for (let i = 0; i < windows.length; i++) {
      const windowText = windows[i];

      const prompt = `
      You are selecting "context moments" from a transcript.
      
      A context moment is a specific spot where a viewer would benefit from additional background,
      definition, or clarification (to be generated later).
      
      Include only moments involving:
      - named concepts, technical terms, acronyms
      - people/companies/products/papers/events
      - jargon or references that are easy to misunderstand
      
      Rules:
      - DO NOT explain anything yet (no definitions, no context text)
      - DO NOT rewrite the transcript
      - triggerQuote MUST be an exact short quote copied from the transcript window
      - Be selective: fewer, higher-quality moments
      
      New requirement: For each moment, decide whether it should have a visual aid.
      Add:
      - visual: one of
        - "none" (not meaningfully visual; mostly abstract)
        - "diagram" (best as a chart/diagram/infographic)
        - "photo" (best as a real image: person/place/object/logo)
        - "both" (either diagram or photo would help)
      - visualQuery: a short, literal search query (2–8 words) for later image search.
        - If visual="none", set visualQuery to null.
        - Do NOT include quotes or special characters.
      
      Return at most ${maxMomentsPerWindow} moments.
      
      Transcript window:
      """${windowText}"""
      `.trim();
      

      const completion = await openai.responses.create({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'system',
            content: 'Return structured JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        text: {
          format: zodTextFormat(ContextMomentsResponseSchema, 'context_moments')
        }
      });

      const output = completion.output_text;
      const data = ContextMomentsResponseSchema.parse(JSON.parse(output));

      allMoments.push(...data.moments);
    }

    const moments = dedupeMoments(allMoments);

    return json({
      success: true,
      moments
    });
  } catch (error) {
    console.error('generate-context-moments error:', error);
    return json(
      {
        success: false,
        error: 'Server error',
        message: (error as Error)?.message ?? 'Unknown error'
      },
      { status: 500 }
    );
  }
}
