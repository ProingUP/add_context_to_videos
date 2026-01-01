import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { GenerateTranscriptSchema } from '$lib/zod/ai';
// 
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY
});

export async function POST({ locals, request }: RequestEvent) {
    const user = locals.user;

    if (!user) {
        return json({ success: false, error: 'Unauthorized', message: 'User not authenticated' }, { status: 401 });
    }

    // const uid = user.id;
    // const email = user.email;
    // const emailVerified = user.emailVerified;
    // if (!email || !emailVerified) {
    //     return json({ success: false, error: 'Unauthorized', message: 'Email not verified' }, { status: 401 });
    // }


    console.log("inside the transcribe server file")
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile) {
            return json(
                { success: false, error: 'No audio file uploaded' },
                { status: 400 }
            );
        }

        if (typeof audioFile === 'string') {
            return json(
                { success: false, error: 'Invalid upload', message: 'Text was sent instead of a file' },
                { status: 400 }
            );
        }

        if (!(audioFile instanceof File)) {
            return json(
                { success: false, error: 'Invalid file type' },
                { status: 400 }
            );
        }
    
        // Now audioFile is definitely a File
        const validationResult = GenerateTranscriptSchema.safeParse({ audio: audioFile });
    
        if (!validationResult.success) {
            // const errorMessage = validationResult.error.errors[0]?.message || 'Invalid audio file';
            return json(
                { success: false, error: 'Invalid' },
                { status: 400 }
            );
        }
    
        const { audio } = validationResult.data;
    
        const audioBuffer = Buffer.from(await audio.arrayBuffer());

        // (OpenAI file uploads for transcriptions are currently limited to 25 MB)
        if (audioBuffer.byteLength > 25 * 1024 * 1024) {
            return json(
                { success: false, error: 'File too large for transcription (max 25 MB)' },
                { status: 400 }
            );
        } // :contentReference[oaicite:1]{index=1}


        // Write to a temp file so we can pass fs.createReadStream() to the SDK
        const safeName = (audio.name && typeof audio.name === 'string') ? audio.name : 'audio.webm';
        const ext = path.extname(safeName) || '.webm';
        const tmpPath = path.join(os.tmpdir(), `whisper-${crypto.randomUUID()}${ext}`);

        try {
            await writeFile(tmpPath, audioBuffer);

            const transcription = await openai.audio.transcriptions.create({
                model: 'whisper-1',
                file: fs.createReadStream(tmpPath),
                response_format: 'verbose_json',
                timestamp_granularities: ['word', 'segment'],
                // Optional knobs:
                // language: 'en',
                // response_format: 'json' // default; whisper-1 also supports 'text', 'srt', 'vtt', 'verbose_json'
            });

            // transcription.text is the transcript string for the json response format
            return json({
                success: true,
                text: transcription.text,
                segments: transcription.segments ?? [], // [{ id, start, end, text, tokens, temperature, avg_logprob, compression_ratio, no_speech_prob, transient, words: [{ word, start, end }, ...] }, ...]
                words: transcription.words ?? [],   // [{ word, start, end }, ...]
            });
        } finally {
            // Best-effort cleanup
            await unlink(tmpPath).catch(() => {});
        }
    
    } catch (err) {
        console.error('Error in generate-transcript:', err);
        return json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
    

}