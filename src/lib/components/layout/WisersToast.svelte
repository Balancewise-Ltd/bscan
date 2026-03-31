<script lang="ts">
  import { onMount } from 'svelte';

  let toasts = $state<Array<{id: number; title: string; body: string; type: string}>>([]);
  let nextId = 0;

  onMount(() => {
    const handler = (e: any) => {
      const { title, body, type } = e.detail;
      const id = nextId++;
      toasts = [...toasts, { id, title, body, type }];
      setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, 4000);
    };
    window.addEventListener('wisers:toast', handler);
    return () => window.removeEventListener('wisers:toast', handler);
  });
</script>

{#if toasts.length > 0}
<div class="wt-stack">
  {#each toasts as toast (toast.id)}
    <div class="wt" class:wt-msg={toast.type === 'message'}>
      <div class="wt-icon">{toast.type === 'message' ? '💬' : '🔔'}</div>
      <div class="wt-body">
        <div class="wt-title">{toast.title}</div>
        {#if toast.body}<div class="wt-text">{toast.body}</div>{/if}
      </div>
      <button class="wt-close" onclick={() => toasts = toasts.filter(t => t.id !== toast.id)}>✕</button>
    </div>
  {/each}
</div>
{/if}

<style>
  .wt-stack { position:fixed; top:16px; right:16px; z-index:10000; display:flex; flex-direction:column; gap:8px; max-width:340px; }
  .wt { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; background:#111117; border:1px solid #1e1e2a; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.4); animation:wtSlide 0.3s ease-out; color:#e4e6ea; }
  .wt-msg { border-color:rgba(245,166,35,0.3); }
  .wt-icon { font-size:18px; flex-shrink:0; margin-top:1px; }
  .wt-body { flex:1; min-width:0; }
  .wt-title { font-size:13px; font-weight:700; }
  .wt-text { font-size:12px; color:#8a8d91; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wt-close { background:none; border:none; color:#606770; cursor:pointer; font-size:12px; padding:2px 4px; flex-shrink:0; }
  .wt-close:hover { color:#e4e6ea; }
  @keyframes wtSlide { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
</style>
