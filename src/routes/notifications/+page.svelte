<script lang="ts">
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let notifications = $state<any[]>([]);
  let loading = $state(true);
  let theme = $state<'dark' | 'light'>('dark');

  onMount(async () => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; document.documentElement.setAttribute('data-wisers-theme', 'light'); }
    if (!$auth.token) return;
    try { notifications = (await api.getNotifications()).notifications || []; } catch {}
    loading = false;
  });

  async function markAllRead() {
    try { await api.markAllNotificationsRead(); notifications = notifications.map(n => ({ ...n, read: 1 })); } catch {}
  }

  async function markRead(id: number, link: string) {
    try { await api.markNotificationRead(id); notifications = notifications.map(n => n.id === id ? { ...n, read: 1 } : n); } catch {}
    if (link) window.location.href = link;
  }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago';
  }

  function icon(type: string) {
    if (type === 'friend_request') return '👋';
    if (type === 'friend_accepted') return '🤝';
    if (type === 'like') return '❤️';
    if (type === 'comment') return '💬';
    if (type === 'message') return '✉️';
    if (type === 'support') return '🛠️';
    return '🔔';
  }
</script>

<svelte:head><title>Notifications — Wisers</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="n" class:light={theme === 'light'}>
  <header class="n-top">
    <a href="/wisers" class="n-back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <a href="/wisers" class="n-logo">W<span>isers</span></a>
    <h1 class="n-title">Notifications</h1>
    <div class="n-right">
      {#if notifications.some(n => !n.read)}
        <button class="n-mark-all" onclick={markAllRead}>Mark all read</button>
      {/if}
    </div>
  </header>

  <div class="n-list">
    {#if loading}
      <div class="n-empty">Loading...</div>
    {:else if notifications.length === 0}
      <div class="n-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <p>No notifications yet</p>
        <p class="n-sub">You'll be notified about friend requests, likes, comments, and messages.</p>
      </div>
    {:else}
      {#each notifications as n (n.id)}
        <button class="n-item" class:unread={!n.read} onclick={() => markRead(n.id, n.link)}>
          <span class="n-icon">{icon(n.type)}</span>
          <div class="n-content">
            <div class="n-item-title">{n.title}</div>
            {#if n.body}<div class="n-item-body">{n.body}</div>{/if}
          </div>
          <div class="n-meta">
            <span class="n-time">{timeAgo(n.created_at)}</span>
            {#if !n.read}<span class="n-dot"></span>{/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .n { --nb: #0a0a0f; --nc: #111117; --nt: #e4e6ea; --nt2: #8a8d91; --nt3: #606770; --nbd: #1e1e2a; --ncard: #16161f; --ngold: #f5a623;
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--nt); background: var(--nb); min-height: 100vh; }
  .n.light { --nb: #fff; --nc: #f0f2f5; --nt: #1c1e21; --nt2: #606770; --nt3: #8a8d91; --nbd: #dddfe2; --ncard: #fff; --ngold: #d4a017; }
  .n-top { display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 52px; background: var(--ncard); border-bottom: 1px solid var(--nbd); position: sticky; top: 0; z-index: 10; }
  .n-back { color: var(--nt2); display: flex; } .n-back:hover { color: var(--nt); }
  .n-logo { font-size: 20px; font-weight: 800; color: var(--ngold); text-decoration: none; letter-spacing: -1px; } .n-logo span { color: var(--nt); }
  .n-title { font-size: 15px; font-weight: 600; margin-left: 8px; }
  .n-right { margin-left: auto; }
  .n-mark-all { padding: 5px 12px; border-radius: 16px; border: 1px solid var(--nbd); background: none; color: var(--ngold); font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .n-list { max-width: 600px; margin: 0 auto; padding: 8px 0; }
  .n-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; text-align: center; color: var(--nt3); gap: 8px; }
  .n-sub { font-size: 12px; }
  .n-item { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border: none; background: transparent; width: 100%; text-align: left; cursor: pointer; color: var(--nt); font-family: inherit; border-bottom: 1px solid rgba(255,255,255,0.02); }
  .n-item:hover { background: rgba(255,255,255,0.02); }
  .n-item.unread { background: rgba(245,166,35,0.04); }
  .n-icon { font-size: 22px; flex-shrink: 0; width: 36px; text-align: center; }
  .n-content { flex: 1; min-width: 0; }
  .n-item-title { font-size: 13px; font-weight: 600; }
  .n-item-body { font-size: 12px; color: var(--nt2); margin-top: 2px; }
  .n-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .n-time { font-size: 10px; color: var(--nt3); }
  .n-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ngold); }
</style>