<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let profile = $state<any>(null);
  let posts = $state<any[]>([]);
  let status = $state('');
  let loading = $state(true);
  let error = $state('');
  let actionMsg = $state('');
  let theme = $state<'dark' | 'light'>('dark');

  $effect(() => {
    const username = $page.params.username;
    if (username) loadProfile(username);
  });

  onMount(() => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; if (typeof document !== 'undefined') document.documentElement.setAttribute('data-wisers-theme', 'light'); }
  });

  async function loadProfile(username: string) {
    loading = true; error = '';
    try {
      profile = await api.getCommunityProfile(username);
      if ($auth.token) {
        status = (await api.getFriendshipStatus(username).catch(() => ({ status: 'none' }))).status;
      }
      try { posts = (await api.getUserPosts(username)).posts || []; } catch {}
    } catch (e: any) { error = e.message || 'User not found'; }
    loading = false;
  }

  async function addFriend() {
    try {
      const res = await api.sendFriendRequest(profile.username);
      actionMsg = res.message;
      status = res.status === 'accepted' ? 'friends' : 'request_sent';
    } catch (e: any) { actionMsg = e.message; }
  }

  async function removeFriend() {
    if (!confirm('Unfriend @' + profile.username + '?')) return;
    await api.unfriend(profile.username); status = 'none';
  }

  function avatarSrc(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return 'https://api-bscan.balancewises.io/avatars/' + url;
  }

  function initial(name: string) { return (name || '?')[0].toUpperCase(); }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60) + 'm';
    if (s < 86400) return Math.floor(s/3600) + 'h'; return Math.floor(s/86400) + 'd';
  }
</script>

<svelte:head>
  <title>{profile?.username ? '@' + profile.username : 'Profile'} — Wisers</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  {#if profile}
    <meta property="og:title" content="@{profile.username} — Wisers" />
    <meta property="og:description" content="{profile.bio || profile.display_name || profile.name} on BSCAN Wisers" />
    <meta name="robots" content="index, follow" />
  {/if}
</svelte:head>

<div class="p" class:light={theme === 'light'}>
  <header class="p-top">
    <a href="/wisers" class="p-back" title="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <a href="/wisers" class="p-logo">W<span>isers</span></a>
    {#if profile}<h1 class="p-page-title">@{profile.username}</h1>{/if}
  </header>

  {#if loading}
    <div class="p-loading">Loading...</div>
  {:else if error}
    <div class="p-error"><p>{error}</p><a href="/wisers">Back to Wisers</a></div>
  {:else if profile}
    <div class="p-content">
      <div class="p-card">
        <div class="p-card-top">
          <div class="p-avatar">
            {#if avatarSrc(profile.avatar_url)}
              <img src={avatarSrc(profile.avatar_url)} alt="" class="p-avatar-img" />
            {:else}
              {initial(profile.display_name || profile.name)}
            {/if}
          </div>
          <div class="p-info">
            <h2 class="p-username">@{profile.username}</h2>
            <div class="p-realname">{profile.display_name || profile.name}</div>
            {#if profile.bio}<p class="p-bio">{profile.bio}</p>{/if}
            <div class="p-meta">
              {#if profile.company}<span>{profile.company}</span>{/if}
              {#if profile.city || profile.country}<span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>{/if}
              {#if profile.website}<a href={profile.website} target="_blank" rel="noopener">{profile.website}</a>{/if}
            </div>
          </div>
        </div>

        <div class="p-stats">
          <div class="p-stat"><div class="p-stat-num">{profile.stats.total_scans}</div><div class="p-stat-label">Scans</div></div>
          <div class="p-stat"><div class="p-stat-num">{profile.stats.avg_score}</div><div class="p-stat-label">Avg Score</div></div>
          <div class="p-stat"><div class="p-stat-num">{profile.stats.friends}</div><div class="p-stat-label">Friends</div></div>
        </div>

        {#if $auth.token && status !== 'self'}
          <div class="p-actions">
            {#if status === 'friends'}
              <a href="/wisers/messages" class="p-btn p-btn-msg">Message</a>
              <button class="p-btn p-btn-friend" onclick={removeFriend}>Friends ✓</button>
            {:else if status === 'request_sent'}
              <button class="p-btn p-btn-pending" disabled>Request Sent</button>
            {:else if status === 'request_received'}
              <button class="p-btn p-btn-accept" onclick={addFriend}>Accept Request</button>
            {:else}
              <button class="p-btn p-btn-add" onclick={addFriend}>Connect</button>
            {/if}
            {#if actionMsg}<span class="p-action-msg">{actionMsg}</span>{/if}
          </div>
        {/if}
      </div>

      {#if posts.length > 0}
        <h3 class="p-section">Posts</h3>
        {#each posts as post}
          <div class="p-post">
            <div class="p-post-text">{post.content}</div>
            <div class="p-post-meta">{timeAgo(post.created_at)} · {post.likes_count || 0} likes · {post.comments_count || 0} comments</div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .p { --pb: #0a0a0f; --pc: #111117; --pt: #e4e6ea; --pt2: #8a8d91; --pt3: #606770; --pbd: #1e1e2a; --pcard: #16161f; --pgold: #f5a623; --phover: rgba(255,255,255,0.04);
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--pt); background: var(--pb); min-height: 100vh; }
  .p.light { --pb: #fff; --pc: #f0f2f5; --pt: #1c1e21; --pt2: #606770; --pt3: #8a8d91; --pbd: #dddfe2; --pcard: #fff; --pgold: #d4a017; --phover: rgba(0,0,0,0.04); }
  .p-top { display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 52px; background: var(--pcard); border-bottom: 1px solid var(--pbd); position: sticky; top: 0; z-index: 10; }
  .p-back { color: var(--pt2); display: flex; text-decoration: none; } .p-back:hover { color: var(--pt); }
  .p-logo { font-size: 20px; font-weight: 800; color: var(--pgold); text-decoration: none; letter-spacing: -1px; } .p-logo span { color: var(--pt); }
  .p-page-title { font-size: 15px; font-weight: 600; margin-left: 8px; }
  .p-loading, .p-error { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; color: var(--pt3); gap: 12px; }
  .p-error a { color: var(--pgold); text-decoration: none; }
  .p-content { max-width: 600px; margin: 24px auto; padding: 0 16px; }
  .p-card { background: var(--pcard); border: 1px solid var(--pbd); border-radius: 16px; padding: 24px; }
  .p-card-top { display: flex; gap: 20px; align-items: flex-start; }
  .p-avatar { width: 80px; height: 80px; border-radius: 50%; background: var(--pgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 28px; flex-shrink: 0; overflow: hidden; }
  .p-avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .p-info { flex: 1; }
  .p-username { font-size: 22px; font-weight: 800; color: var(--pgold); }
  .p-realname { font-size: 14px; color: var(--pt2); margin-top: 2px; }
  .p-bio { font-size: 14px; line-height: 1.5; margin-top: 8px; color: var(--pt); }
  .p-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--pt3); }
  .p-meta a { color: var(--pgold); text-decoration: none; }
  .p-stats { display: flex; gap: 24px; justify-content: center; padding: 20px 0; margin-top: 16px; border-top: 1px solid var(--pbd); }
  .p-stat { text-align: center; }
  .p-stat-num { font-size: 22px; font-weight: 800; }
  .p-stat-label { font-size: 11px; color: var(--pt3); text-transform: uppercase; letter-spacing: 0.05em; }
  .p-actions { display: flex; gap: 8px; justify-content: center; margin-top: 16px; align-items: center; }
  .p-btn { padding: 8px 24px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; border: none; text-decoration: none; }
  .p-btn-add, .p-btn-accept { background: var(--pgold); color: #000; }
  .p-btn-msg { background: transparent; border: 1px solid var(--pbd); color: var(--pt); }
  .p-btn-msg:hover { border-color: var(--pgold); color: var(--pgold); }
  .p-btn-friend { background: transparent; border: 1px solid #10b981; color: #10b981; }
  .p-btn-pending { background: transparent; border: 1px solid var(--pbd); color: var(--pt3); }
  .p-action-msg { font-size: 12px; color: #10b981; }
  .p-section { font-size: 16px; font-weight: 700; margin: 24px 0 12px; }
  .p-post { background: var(--pcard); border: 1px solid var(--pbd); border-radius: 12px; padding: 16px; margin-bottom: 8px; }
  .p-post-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .p-post-meta { font-size: 11px; color: var(--pt3); margin-top: 8px; }
</style>