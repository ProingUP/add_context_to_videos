<script lang="ts">
    import { onDestroy } from "svelte";
    import { getSignedR2UploadUrl } from "$lib/api/upload";
  
    let files: FileList | null = null;
    let selectedFile: File | null = null;
  
    let previewUrl: string | null = null;
    let previewKind: "video" | "audio" | "unknown" = "unknown";
  
    let uploading = false;
    let uploadProgress = 0;
    let uploadError: string | null = null;
  
    let currentJobId: string | null = null;
    let currentR2Key: string | null = null;
  
    function isProbablyVideo(file: File) {
      if (file.type?.startsWith("video/")) return true;
      const ext = file.name.split(".").pop()?.toLowerCase();
      return ext === "mp4" || ext === "mov" || ext === "webm" || ext === "mkv";
    }
  
    function isProbablyAudio(file: File) {
      if (file.type?.startsWith("audio/")) return true;
      const ext = file.name.split(".").pop()?.toLowerCase();
      return ext === "mp3" || ext === "m4a" || ext === "wav" || ext === "ogg";
    }
  
    function setPreviewForFile(file: File | null) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
  
      previewUrl = null;
      previewKind = "unknown";
      selectedFile = file;
  
      if (!file) return;
  
      previewUrl = URL.createObjectURL(file);
      if (isProbablyVideo(file)) previewKind = "video";
      else if (isProbablyAudio(file)) previewKind = "audio";
      else previewKind = "unknown";
    }
  
    onDestroy(() => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
  
    async function handleUploadOriginalToR2(): Promise<void> {
      if (uploading) return;
  
      const file = selectedFile ?? files?.[0] ?? null;
      if (!file) {
        uploadError = "No file selected";
        return;
      }
  
      uploading = true;
      uploadProgress = 0;
      uploadError = null;
      currentJobId = null;
      currentR2Key = null;
  
      try {
        // 1) Ask backend for a signed upload URL
        const signed = await getSignedR2UploadUrl({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          bytes: file.size
        });
  
        if (!signed.success) {
          throw new Error(signed.error || "Failed to get signed upload url");
        }
  
        const { uploadUrl, jobId, key } = signed.data;
        currentJobId = jobId;
        currentR2Key = key;
  
        // 2) Upload to R2 using XHR so we can track progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
  
          // Keep this only if your server includes contentType when signing.
          // If you get signature mismatch errors, remove this header.
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
  
          xhr.upload.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            uploadProgress = Math.round((evt.loaded / evt.total) * 100);
          };
  
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              uploadProgress = 100;
              resolve();
            } else {
              reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || "unknown error"}`));
            }
          };

          console.log("Starting upload to R2:", { jobId, key, uploadUrl });
          console.log("xhr:", xhr);
  
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new Error("Upload aborted"));
  
          xhr.send(file);
        });
  
        console.log("Upload complete:", { jobId: currentJobId, key: currentR2Key });
  
        // (Later) call finalize endpoint here, e.g. /api/private/upload/finalize
      } catch (err: any) {
        uploadError = err?.message ?? "Upload failed";
        console.error("handleUploadOriginalToR2 error:", err);
      } finally {
        uploading = false;
      }
    }
  </script>
  
  <div class="p-4 space-y-4">
    <h1 class="font-bold text-2xl">Add Context To Video</h1>
  
    <input
      type="file"
      bind:files
      accept=".mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm"
      class="border rounded p-2"
      onchange={() => setPreviewForFile(files?.[0] ?? null)}
    />
  
    {#if selectedFile}
      <div class="text-sm opacity-80">
        Selected: <span class="font-semibold">{selectedFile.name}</span>
        ({Math.round(selectedFile.size / 1024)} KB)
      </div>
    {/if}
  
    {#if previewUrl && previewKind === "video"}
      <video class="w-full max-w-3xl rounded border" src={previewUrl} controls playsinline />
    {:else if previewUrl && previewKind === "audio"}
      <audio class="w-full max-w-2xl" src={previewUrl} controls />
    {/if}
  
    <div class="flex flex-col mt-2">
      <div class={[
        "w-min px-2 py-1 border-2 border-blue-700 rounded-lg bg-blue-300",
        (!selectedFile || uploading) && "opacity-50"
      ]}>
        <span
          class="cursor-pointer text-nowrap"
          onclick={handleUploadOriginalToR2}
        >
          {uploading ? "Uploading..." : "Upload to R2"}
        </span>
      </div>
  
      {#if uploading}
        <div class="mt-2 text-sm opacity-80">Uploading… {uploadProgress}%</div>
      {/if}
  
      {#if uploadError}
        <div class="mt-2 text-sm text-red-700">{uploadError}</div>
      {/if}
  
      {#if currentJobId}
        <div class="mt-2 text-xs opacity-70">
          jobId: {currentJobId} • key: {currentR2Key}
        </div>
      {/if}
    </div>
  </div>
  