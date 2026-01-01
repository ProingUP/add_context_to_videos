import type { ApiResponseWithData, ApiResponse} from '$lib/types/api';
import { apiFetch } from './fetch';

export async function generateTranscript(audioFile: File): Promise<ApiResponseWithData<{
    text: string,
    words: string[],
    segments: any[]
}>> {
    
    const endpoint = '/api/private/ai/generate-transcript';

    try {
        const response = await apiFetch(endpoint, {
            method: 'POST',
            body: (() => {
                const formData = new FormData();
                formData.append('audio', audioFile);
                return formData;
            })()
        });

        console.log("response:", response)

        console.log('after transcribe')

        console.log('Response:', response);

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Failed to generate transcript',
                message: data.message
            };
        }

        if (!data.success) {
            return {
                success: false,
                error: data.error || 'Failed to generate transcript',
                message: data.message
            };
        }

        return {
            success: true,
            data: {
                text: data.text ?? '',
                words: data.words ?? [],
                segments: data.segments ?? [],
            }
        };

    } catch (error) {
        return {
            success: false,
            error: (error as Error).message || 'An unknown error occurred',
        };
    }
}


export type LogicalChunk = {
  title?: string;
  summary?: string;
  text?: string;        // optional if your backend returns text per chunk
  segmentStart?: number;
  segmentEnd?: number;
};

export type TextContextItem = {
  title?: string;            // short label like "Scaling laws"
  context?: string;          // the actual explanation shown to the user
  keywords?: string[];       // optional tags
  links?: { title: string; url: string }[]; // optional references
  segmentStart?: number;     // seconds (or ms) - match your transcript convention
  segmentEnd?: number;
};

export async function generateContextMoments(
  transcriptText: string
): Promise<ApiResponseWithData<{ moments: ContextMoment[] }>> {
  const endpoint = '/api/private/ai/generate-context-moments';

  try {
    const response = await apiFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: transcriptText })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to generate text context',
        message: data.message
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to generate text context',
        message: data.message
      };
    }

    return {
      success: true,
      data: {
        moments: data.moments ?? []
      }
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'An unknown error occurred'
    };
  }
}

export type ModelRoute = 'TECHNICAL' | 'NARRATIVE' | 'ARTISTIC';

export type EnrichedLogicalChunk = LogicalChunk & {
  chunkIndex: number;
  prompt: string;
  promptType: ModelRoute;
  imageB64?: string | null;
};

export type MediaPrompt = {
  /** Index of the chunk this prompt corresponds to */
  chunkIndex: number;

  /** The actual prompt you’ll send to gpt-image-1 (or other image model) */
  prompt: string;

  /** Optional: can be useful for UI/debugging */
  title?: string;
};

export async function createMediaPrompts(
  chunks: LogicalChunk[]
): Promise<ApiResponseWithData<{ enrichedChunks: EnrichedLogicalChunk[] }>> {
  const endpoint = '/api/private/ai/create-media-prompts';

  try {
    const response = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to create media prompts',
        message: data.message
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to create media prompts',
        message: data.message
      };
    }

    return {
      success: true,
      data: {
        // Expecting backend to return { enrichedChunks: [...] }
        enrichedChunks: data.enrichedChunks ?? []
      }
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'An unknown error occurred'
    };
  }
}

export type ContextMoment = {
  title: string;
  triggerQuote: string;
  segmentStart?: number | null;
  segmentEnd?: number | null;
  importance: 'low' | 'medium' | 'high';
  visual: 'none' | 'diagram' | 'photo' | 'both';
  visualQuery?: string | null; // short query for later image search
};

export type EnrichedContextMoment = ContextMoment & {
  context: string; // the explanation text generated in the second request
  // optional: keywords, if you decide later
  // keywords?: string[];
};

export type ImageRef = {
  title: string;
  imageUrl: string;
  pageUrl: string;
  author?: string | null;
  licenseShort?: string | null;
  licenseUrl?: string | null;
  attribution?: string | null;
  source?: string; // "Wikimedia Commons"
};

export type EnrichedContextMomentWithImages = EnrichedContextMoment & {
  images?: ImageRef[];
};

export async function generateContextDetails(
  moments: ContextMoment[],
  transcriptText?: string // optional, but recommended for best quality
): Promise<ApiResponseWithData<{ moments: EnrichedContextMomentWithImages[] }>> {
  const endpoint = '/api/private/ai/generate-context-details';

  try {
    const response = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moments,
        text: transcriptText // include if you have it
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to generate context details',
        message: data.message
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to generate context details',
        message: data.message
      };
    }

    return {
      success: true,
      data: {
        moments: data.moments ?? []
      }
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'An unknown error occurred'
    };
  }
}


export type TranscriptSegment = {
  start?: number;       // Whisper often uses "start"
  end?: number;         // and "end"
  text?: string;

  // (optional fallback keys)
  segmentStart?: number;
  segmentEnd?: number;
};

export type TimelinePoint = {
  momentIndex: number;
  segmentIndex: number;
  triggerQuote: string;
  title: string;
  importance: 'low' | 'medium' | 'high';
  visual: 'none' | 'diagram' | 'photo' | 'both';
  visualQuery?: string | null;
  context: string;

  t_start: number;
  t_end: number;
};