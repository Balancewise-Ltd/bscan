<script lang="ts">
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let notifications = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (!$auth.token) return;
    try {
      const res = await api.getNotifications();
      notifications = res.notifications || [];
    } catch {}
    loading = false;
  });

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      notifications = notifications.map(n => ({ ...n, read: 1 }));
    } catch {}
  }

  async function markRead(id: number) {
    try {
      await api.markNotificationRead(id);
      notifications = notifications.map(n => n.id === id ? { ...n, read: 1 } : n);
    } catch {}
  }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }

  function icon(type: string) {
    if (type === 'friend_request') return '👋';
    if (type === 'friend_accepted') return '🤝';
    if (type === 'like') return '❤️';
    if (type === 'comment') return '💬';
    if (type === 'message') return '✉️';
    return '🔔';
  }
</script>

<svelte:head><title>Notifications — BSCAN</title></svelte:head>

<div class="notif-page">
  <div class="notif-header">
    <h1>Notifications</h1>
    {#if notifications.some(n => !n.read)}
      <button class="btn-mark-all" onclick={markAllRead}>Mark all as read</button>
    {/if}
  </div>

  {#if loading}
    <p class="loading">Loading...</p>
  {:else if notifications.length === 0}
    <div class="empty">No notifications yet</div>
  {:else}
    {#each notifications as n (n.id)}
      <button class="notif-item" class:unread={!n.read} onclick={() => { markRead(n.id); if (n.link) window.location.href = n.link; }}>
        <span class="notif-icon">{icon(n.type)}</span>
        <div class="notif-content">
          <div class="notif-title">{n.title}</div>
          {#if n.body}<div class="notif-body">{n.body}</div>{/if}
        </div>
        <span class="notif-time">{timeAgo(n.created_at)}</span>
        {#if !n.read}<span class="notif-dot"></span>{/if}
      </button>
    {/each}
  {/if}
</div>

<style>
  .notif-page { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
  .notif-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .notif-header h1 { font-size: 22px; font-weight: 800; }
  .btn-mark-all { padding: 6px 14px; border: 1px solid var(--clr-border); border-radius: 8px; background: none; color: var(--clr-gold, #f5a623); font-size: 11px; font-weight: 700; cursor: pointer; }
  .loading { text-align: center; color: var(--clr-text-muted); padding: 40px; }
  .empty { text-align: center; color: var(--clr-text-muted); padding: 60px; font-size: 14px; }
  .notif-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--clr-border, #2a2a3e); border-radius: 10px; margin-bottom: 8px; background: var(--clr-bg-card, #1a1a2e); cursor: pointer; width: 100%; text-align: left; position: relative; }
  .notif-item:hover { border-color: var(--clr-gold); }
  .notif-item.unread { background: rgba(245,166,35,0.04); border-color: rgba(245,166,35,0.2); }
  .notif-icon { font-size: 20px; flex-shrink: 0; }
  .notif-content { flex: 1; min-width: 0; }
  .notif-title { font-size: 13px; font-weight: 600; color: var(--clr-text); }
  .notif-body { font-size: 12px; color: var(--clr-text-secondary); margin-top: 2px; }
  .notif-time { font-size: 10px; color: var(--clr-text-muted); flex-shrink: 0; }
  .notif-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clr-gold); position: absolute; top: 8px; right: 8px; }
</style>