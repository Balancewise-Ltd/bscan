<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';
  import { onMount } from 'svelte';
  import { timeAgo } from '$lib/utils/time';

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
              <a href="/wisers/{post.username}" class="ht-author">{post.display_name || post.user_name}</a><span class="ht-badge" style="fill:#f5a623"><svg viewBox="0 0 22 22" width="16" height="16"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg></span>
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
  .ht-badge { display:inline-flex;vertical-align:middle;margin-left:2px; }
</style>
