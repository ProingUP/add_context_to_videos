import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import crypto from 'crypto';

import {
  PRIVATE_R2_ACCOUNT_ID,
  PRIVATE_R2_UPLOAD_ACCESS_KEY_ID,
  PRIVATE_R2_UPLOAD_SECRET_ACCESS_KEY,
  PRIVATE_R2_UPLOAD_BUCKET
} from '$env/static/private';

import { supabaseAdmin } from '$lib/server/supabaseAdmin';

const InputSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  bytes: z.number().int().positive()
});

function sanitizeFilename(name: string): string {
  const base = name.split('/').pop() ?? 'file';
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function getExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 10 ? ext : 'bin';
}

/**
 * Cloudflare R2 is S3-compatible; create pre-signed PUT URL using AWS SDK v3.
 * Install:
 *   npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
async function createPresignedPutUrl(args: {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const endpoint = `https://${PRIVATE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: PRIVATE_R2_UPLOAD_ACCESS_KEY_ID,
      secretAccessKey: PRIVATE_R2_UPLOAD_SECRET_ACCESS_KEY
    }
  });

  const cmd = new PutObjectCommand({
    Bucket: PRIVATE_R2_UPLOAD_BUCKET,
    Key: args.key,
    ContentType: args.contentType
  });

  return getSignedUrl(client, cmd, { expiresIn: args.expiresInSeconds });
}

export async function POST({ request, locals }: RequestEvent) {
  try {
    // ---- auth guard ----
    const userId =
      (locals as any)?.user?.id ??
      (locals as any)?.session?.user?.id ??
      null;

    if (!userId) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        { success: false, error: 'Invalid input', message: parsed.error.message },
        { status: 400 }
      );
    }

    const { filename, contentType, bytes } = parsed.data;

    // Optional: enforce max upload size server-side
    const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
    if (bytes > MAX_BYTES) {
      return json(
        { success: false, error: 'File too large', message: `Max size is ${MAX_BYTES} bytes` },
        { status: 413 }
      );
    }

    // ---- create job row FIRST (DB generates id) ----
    // Keep minimal fields here, then update r2_key after we know jobId.
    const { data: createdJob, error: createErr } = await supabaseAdmin
      .from('media_jobs')
      .insert({
        user_id: userId,
        status: 'uploading',
        stage: 'awaiting_upload',
        // bucket default is set in DB, but you can still pass it explicitly if you want:
        bucket: 'adding-context-media-upload',
        // r2_key is NOT NULL in schema, so we insert a placeholder then update.
        // Alternative: change schema to allow null temporarily. This keeps schema strict.
        r2_key: 'pending'
      })
      .select('id')
      .single();

    if (createErr || !createdJob?.id) {
      console.error('Failed creating media_jobs row:', createErr);
      return json(
        { success: false, error: 'Failed to create job', message: createErr?.message },
        { status: 500 }
      );
    }

    const jobId: string = createdJob.id;

    // ---- build key using DB jobId ----
    const safeName = sanitizeFilename(filename);
    const ext = getExt(safeName);
    const key = `jobs/${userId}/${jobId}/original.${ext}`;

    // ---- update job row with real metadata + r2_key ----
    const { error: updateErr } = await supabaseAdmin
      .from('media_jobs')
      .update({
        r2_key: key,
        original_filename: safeName,
        original_content_type: contentType,
        original_size_bytes: bytes,
        // stage_progress: 0,  // optional
      })
      .eq('id', jobId)
      .eq('user_id', userId);

    if (updateErr) {
      console.error('Failed updating job row with r2_key:', updateErr);
      // Best effort cleanup: mark as error so it doesn’t sit forever
      await supabaseAdmin
        .from('media_jobs')
        .update({
          status: 'error',
          last_error: `Failed to update r2_key: ${updateErr.message}`,
          stage_error: updateErr.message
        })
        .eq('id', jobId)
        .eq('user_id', userId);

      return json(
        { success: false, error: 'Failed to prepare job', message: updateErr.message },
        { status: 500 }
      );
    }

    // ---- create presigned PUT url ----
    const expiresInSeconds = 60 * 10; // 10 minutes
    const uploadUrl = await createPresignedPutUrl({
      key,
      contentType,
      expiresInSeconds
    });

    return json({
      success: true,
      jobId,
      key,
      uploadUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    });
  } catch (err: any) {
    console.error('get-signed-upload-url error:', err);
    return json(
      { success: false, error: 'Server error', message: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
