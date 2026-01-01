// src/lib/api/upload.ts
import type { ApiResponseWithData } from '$lib/types/api';
import { apiFetch } from './fetch';

export type SignedR2Upload = {
  jobId: string;
  key: string;                 // where the object will live in R2
  uploadUrl: string;           // signed PUT (or POST) URL
  publicUrl?: string | null;   // optional, if you expose a CDN domain
  expiresAt?: string | null;   // optional
};

/**
 * Request a signed upload URL for R2.
 * (Despite your message saying "download url", for uploads you want a signed *upload* URL.)
 */
export async function getSignedR2UploadUrl(args: {
  filename: string;
  contentType: string;
  bytes: number;
}): Promise<ApiResponseWithData<SignedR2Upload>> {
  const endpoint = '/api/private/upload/get-signed-upload-url';

  try {
    const res = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || 'Failed to get signed upload url',
        message: data?.message
      };
    }

    return {
      success: true,
      data: {
        jobId: data.jobId,
        key: data.key,
        uploadUrl: data.uploadUrl,
        publicUrl: data.publicUrl ?? null,
        expiresAt: data.expiresAt ?? null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'An unknown error occurred'
    };
  }
}
