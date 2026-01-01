<script lang="ts">
    export let p: any; // or TimelinePoint if you import it
  </script>
  
  <div
    class="mb-2 w-full max-w-4xl rounded-xl border bg-white/90 backdrop-blur px-4 py-3 shadow"
    style="transition: opacity 180ms ease;"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm font-semibold truncate">{p.title}</div>
        <div class="mt-1 text-xs opacity-80 line-clamp-3 whitespace-pre-wrap">
          {p.context}
        </div>
      </div>
  
      <div class="shrink-0 text-[11px] opacity-60">
        {p.t_start.toFixed(1)}–{p.t_end.toFixed(1)}s
      </div>
    </div>
  </div>
  