// $lib/zod/ai.ts
import { z } from 'zod';
import {
  MAX_AUDIO_FILE_SIZE,
  MAX_CHUNK_SUMMARY_LENGTH,
  MAX_CHUNK_TITLE_LENGTH,
  MAX_CHUNKS,
  MAX_IMAGE_GEN_PROMPT_LENGTH,
  MAX_TEXT_LENGTH,
} from '$src/constants/files';

export const GenerateTranscriptSchema = z.object({
  audio: z.instanceof(File, { message: 'Must be a valid file' })
    .refine((file) => file.size > 0, { message: 'File cannot be empty' })
    .refine((file) => file.size <= MAX_AUDIO_FILE_SIZE, {
      message: `File too large — maximum size is ${ MAX_AUDIO_FILE_SIZE / (1024^3) }GB`,
    })
    .refine(
      (file) =>
        [
          'audio/mpeg',
          'audio/mp4',
          'audio/wav',
          'audio/webm',
          'audio/ogg',
          'audio/x-m4a',
          'audio/x-wav',
        ].includes(file.type),
      {
        message: 'Unsupported format. Please upload MP3, M4A, WAV, WEBM, or OGG.',
      }
    ),
});

export const GenerateLogicalChunksInputSchema = z.object({
	text: z.string().trim().min(1).max(200_000) // prevent absurd payloads
});

export const LogicalChunkSchema = z.object({
  title: z.string().trim().min(1).max(MAX_CHUNK_TITLE_LENGTH).nullable(),
  summary: z.string().trim().min(1).max(MAX_CHUNK_SUMMARY_LENGTH).nullable(),
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH).nullable(),
  segmentStart: z.number().int().nonnegative().nullable(),
  segmentEnd: z.number().int().nonnegative().nullable()
});

export const CreateMediaPromptsInputSchema = z.object({
  chunks: z.array(LogicalChunkSchema).min(1).max(MAX_CHUNKS) // hard cap to avoid absurd payloads/cost
});

export const GenerateImageInputSchema = z.object({
  prompt: z.string().min(1),
  type: z.enum(['TECHNICAL', 'NARRATIVE', 'ARTISTIC']).optional().default('NARRATIVE')
});

export const GenerateTextContextInputSchema = z.object({
  text: z.string().min(20),
  // Optional: if you already have transcript segments w/ timestamps,
  // you should pass those instead of raw text.
  // segments: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).optional(),
  maxMomentsPerWindow: z.number().int().min(1).max(12).nullable().optional()
});