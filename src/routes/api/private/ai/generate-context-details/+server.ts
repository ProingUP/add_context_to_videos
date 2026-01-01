import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

/**
 * Input "moment" (from /generate-context-moments).
 * This endpoint enriches each moment with an explanation/context string,
 * and (optionally) attaches Wikimedia Commons images when the moment is visual.
 *
 * NOTE: Wikimedia image retrieval is currently commented out because results were not effective.
 *       You can re-enable it later by uncommenting the Wikimedia helper section + the attach step.
 */
export type ContextMoment = {
  title: string;
  triggerQuote: string;
  segmentStart?: number | null;
  segmentEnd?: number | null;
  importance: 'low' | 'medium' | 'high';

  // NEW (from generate-context-moments):
  visual: 'none' | 'diagram' | 'photo' | 'both';
  visualQuery?: string | null;
};

export type ImageRef = {
  title: string; // Wikimedia file title like "File:Something.jpg"
  imageUrl: string; // thumbnail or full image URL
  pageUrl: string; // Wikimedia file page
  author?: string | null;
  licenseShort?: string | null;
  licenseUrl?: string | null;
  attribution?: string | null;
  source: 'Wikimedia Commons';
};

export type EnrichedContextMoment = ContextMoment & {
  context: string;
  images?: ImageRef[];
};

// ---------- 1) Input schema ----------
const GenerateContextDetailsInputSchema = z.object({
  text: z.string().nullable().optional(),

  moments: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        triggerQuote: z.string().min(5).max(240),
        importance: z.enum(['low', 'medium', 'high']),
        segmentStart: z.number().nullable().optional(),
        segmentEnd: z.number().nullable().optional(),

        // NEW:
        visual: z.enum(['none', 'diagram', 'photo', 'both']),
        visualQuery: z.string().min(2).max(80).nullable().optional()
      })
    )
    .min(1, 'At least one moment is required')
});

// ---------- 2) Model output schema ----------
const EnrichedContextMomentSchema = z.object({
  title: z.string().min(2).max(80),
  triggerQuote: z.string().min(5).max(240),
  importance: z.enum(['low', 'medium', 'high']),
  segmentStart: z.number().nullable().optional(),
  segmentEnd: z.number().nullable().optional(),

  // Keep these passthrough fields so merge is easy:
  visual: z.enum(['none', 'diagram', 'photo', 'both']).nullable().optional(),
  visualQuery: z.string().min(2).max(80).nullable().optional(),

  context: z.string().min(20).max(900)
});

const EnrichedContextMomentsResponseSchema = z.object({
  moments: z.array(EnrichedContextMomentSchema)
});

// ---------- 3) Utility: compact & stable moment list for prompting ----------
function formatMomentsForPrompt(moments: ContextMoment[]): string {
  return moments
    .map((m, idx) => {
      const time =
        m.segmentStart != null || m.segmentEnd != null
          ? ` [${m.segmentStart ?? 'null'}–${m.segmentEnd ?? 'null'}]`
          : '';
      const vis = `visual: ${m.visual}${m.visualQuery ? ` (query: ${m.visualQuery})` : ''}`;

      return `#${idx + 1}${time}
title: ${m.title}
importance: ${m.importance}
${vis}
triggerQuote: "${m.triggerQuote}"`;
    })
    .join('\n\n');
}

// ---------- 4) Utility: merge model output back onto original moments safely ----------
function mergeByQuote(
  original: ContextMoment[],
  enriched: EnrichedContextMoment[]
): EnrichedContextMoment[] {
  const byQuote = new Map<string, EnrichedContextMoment>();
  for (const m of enriched) byQuote.set(m.triggerQuote, m);

  return original.map((o, i) => {
    const hit = byQuote.get(o.triggerQuote);
    if (hit) {
      // Ensure visual fields always come from original source-of-truth
      return {
        ...hit,
        visual: o.visual,
        visualQuery: o.visualQuery ?? null
      };
    }

    const fallback = enriched[i];
    if (fallback) {
      return {
        ...o,
        context: fallback.context
      };
    }

    return { ...o, context: '' };
  });
}

/* ===========================
   5) Wikimedia helper (DISABLED)
   =========================== */

/*
type WikimediaResult = {
  title: string;
  imageUrl: string;
  pageUrl: string;
  author?: string | null;
  licenseShort?: string | null;
  licenseUrl?: string | null;
  attribution?: string | null;
  source: 'Wikimedia Commons';
};

function pickMeta(v: any): string | null {
  if (!v) return null;
  // extmetadata values can be { value: "..." }
  const s = typeof v === 'string' ? v : v?.value;
  if (!s) return null;
  // keep it short-ish
  return String(s).replace(/\s+/g, ' ').trim().slice(0, 400);
}

async function wikimediaSearchImages(query: string, limit = 3): Promise<WikimediaResult[]> {
  // Keep queries clean and short
  const q = query.trim().replace(/[^\w\s-]/g, '').slice(0, 80);
  if (!q) return [];

  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', q);
  url.searchParams.set('gsrlimit', String(Math.min(Math.max(limit, 1), 5)));
  url.searchParams.set('gsrnamespace', '6'); // File namespace
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '900'); // thumbnail width

  const r = await fetch(url.toString(), {
    headers: {
      // identify your app politely
      'User-Agent': 'PodcastVisualizer/0.1 (local dev) https://localhost'
    }
  });

  if (!r.ok) return [];
  const data = await r.json();

  const pages = data?.query?.pages;
  if (!pages) return [];

  const results: WikimediaResult[] = [];

  for (const page of Object.values<any>(pages)) {
    const info = page?.imageinfo?.[0];
    const thumb = info?.thumburl ?? info?.url;
    const descUrl = info?.descriptionurl;

    if (!thumb || !descUrl || !page?.title) continue;

    const meta = info?.extmetadata ?? {};
    results.push({
      title: page.title,
      imageUrl: thumb,
      pageUrl: descUrl,
      author: pickMeta(meta?.Artist),
      licenseShort: pickMeta(meta?.LicenseShortName),
      licenseUrl: pickMeta(meta?.LicenseUrl),
      attribution: pickMeta(meta?.Attribution),
      source: 'Wikimedia Commons'
    });

    if (results.length >= limit) break;
  }

  return results;
}

// Simple concurrency limiter so you don’t blast Wikimedia with N fetches at once
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}
*/

// ---------- 6) The endpoint ----------
export async function POST({ request }: RequestEvent) {
  try {
    const body = await request.json();
    const parsed = GenerateContextDetailsInputSchema.safeParse(body);

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

    const { text, moments } = parsed.data;

    const prompt = `
You are generating short on-screen "context cards" explanations for a video.

You will be given:
1) (Optional) transcript text for reference
2) a list of context moments, each with:
   - title
   - importance
   - triggerQuote (must stay EXACT)
   - optional timestamps
   - visual + visualQuery (do not change)

Your job:
- For EACH moment, write a short explanation ("context") that helps a typical viewer.
- The explanation should be concise, factual, and helpful.
- If the quote references something ambiguous, use the transcript (if provided) to infer the likely meaning.
- Do NOT change title/triggerQuote/importance/timestamps/visual/visualQuery. Copy them through as-is.
- Do NOT add links.
- Avoid hallucinating specifics. If uncertain, explain generally without inventing details.

Return JSON only in this shape:
{ "moments": [ { title, triggerQuote, importance, segmentStart?, segmentEnd?, visual, visualQuery?, context } ... ] }

Moments to enrich:
${formatMomentsForPrompt(moments)}

Transcript (optional, may be empty):
"""${text ?? ''}"""
`.trim();

    const completion = await openai.responses.create({
      model: 'gpt-5-mini',
      input: [
        { role: 'system', content: 'Return structured JSON only.' },
        { role: 'user', content: prompt }
      ],
      text: {
        format: zodTextFormat(EnrichedContextMomentsResponseSchema, 'context_details')
      }
    });

    const output = completion.output_text;
    const modelData = EnrichedContextMomentsResponseSchema.parse(JSON.parse(output));

    // Preserve ordering & copy over visual fields from original
    const merged = mergeByQuote(moments, modelData.moments as any);

    // Drop empties (safeguard)
    const finalMoments = merged.filter((m) => m.context && m.context.trim().length > 0);

    // ===========================
    // Wikimedia image attach (DISABLED)
    // ===========================
    //
    // const momentsWithImages = await mapLimit(
    //   finalMoments,
    //   3, // concurrency limit
    //   async (m) => {
    //     if (m.visual === 'none') return m;
    //
    //     const query =
    //       (m.visualQuery && m.visualQuery.trim().length > 0)
    //         ? m.visualQuery
    //         : m.title;
    //
    //     const images = await wikimediaSearchImages(query, 3);
    //
    //     return {
    //       ...m,
    //       images
    //     };
    //   }
    // );
    //
    // return json({
    //   success: true,
    //   moments: momentsWithImages
    // });

    // Return without images for now
    return json({
      success: true,
      moments: finalMoments
    });
  } catch (error) {
    console.error('generate-context-details error:', error);
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
