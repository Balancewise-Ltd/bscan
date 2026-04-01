<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';
  import { onMount } from 'svelte';

  let tag = $state('');
  let posts = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    tag = $page.url.searchParams.get('tag') || '';
    if (tag) {
      try {
        const res = await api.getHashtagPosts(tag);
        posts = res.posts || [];
      } catch {}
    }
    loading = false;
  });

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
</script>

<svelte:head><title>#{tag} — Wisers</title></svelte:head>

<div class="ht-page">
  <div class="ht-header">
    <a href="/wisers" class="ht-back">← Back</a>
    <h1>#{tag}</h1>
    <span class="ht-count">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
  </div>

  {#if loading}
    <div class="ht-loading">Loading...</div>
  {:else if posts.length === 0}
    <div class="ht-empty">No posts with #{tag} yet.</div>
  {:else}
    <div class="ht-feed">
      {#each posts as post}
        <div class="ht-post">
          <div class="ht-post-header">
            <a href="/wisers/{post.username}" class="ht-avatar">{initial(post.display_name || post.user_name)}</a>
            <div class="ht-meta">
              <a href="/wisers/{post.username}" class="ht-author">{post.display_name || post.user_name}</a>
              <span class="ht-handle">@{post.username} · {timeAgo(post.created_at)}</span>
            </div>
          </div>
          <div class="ht-body">{post.content}</div>
          {#if post.image_url}<div class="ht-img"><img src={post.image_url} alt="" loading="lazy" /></div>{/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ht-page { max-width: 680px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e2e8f0; }
  .ht-header { margin-bottom: 24px; }
  .ht-back { color: #f5a623; text-decoration: none; font-size: 14px; }
  .ht-back:hover { text-decoration: underline; }
  .ht-header h1 { font-size: 28px; font-weight: 700; margin: 8px 0 4px; }
  .ht-count { color: #94a3b8; font-size: 14px; }
  .ht-loading, .ht-empty { text-align: center; color: #64748b; padding: 40px; }
  .ht-post { background: #1a1a2e; border: 1px solid #2a2a3a; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
  .ht-post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .ht-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; text-decoration: none; font-size: 16px; flex-shrink: 0; }
  .ht-author { font-weight: 600; color: #e2e8f0; text-decoration: none; font-size: 14px; }
  .ht-author:hover { color: #f5a623; }
  .ht-handle { color: #64748b; font-size: 13px; }
  .ht-body { font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .ht-img { margin-top: 10px; border-radius: 12px; overflow: hidden; }
  .ht-img img { width: 100%; max-height: 500px; object-fit: cover; display: block; }
</style>
