<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { connectWS, wsUnreadDMs, fetchUnreadCounts } from '$lib/stores/wisers-ws';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';
  import { page } from '$app/stores';

  let open = $state(false);
  let activeConv = $state<any>(null);
  let conversations = $state<any[]>([]);
  let messages = $state<any[]>([]);
  let newMsg = $state('');
  let sending = $state(false);
  let messagesEl: HTMLDivElement | undefined = $state();
  let pollInterval: any;
  let typingUser = $state('');
  let typingTimeout: any = null;

  let isVisible = $derived(
    !!$auth.token &&
    !$page.url.pathname.startsWith('/wisers/messages')
  );

  $effect(() => {
    if ($auth.token) { connectWS($auth.token); fetchUnreadCounts($auth.token); }
  });

  $effect(() => {
    if ($auth.token && isVisible) loadConversations();
  });

  async function loadConversations() {
    try {
      const res = await api.getConversations();
      conversations = res.conversations || [];
    } catch {}
  }

  async function openConv(conv: any) {
    activeConv = conv;
    try {
      const res = await api.getMessages(conv.id, true);
      messages = res.messages || [];
      scrollBottom();
    } catch {}
  }

  async function send() {
    if (!newMsg.trim() || sending || !activeConv) return;
    sending = true;
    try {
      await api.sendMessage(activeConv.other_username, newMsg.trim());
      newMsg = '';
      const res = await api.getMessages(activeConv.id);
      messages = res.messages || [];
      scrollBottom();
      loadConversations();
    } catch {}
    sending = false;
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function timeAgo(d: string) {
    if (!d) return '';
    const date = new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
    const s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }

  function initial(n: string) { return (n || '?')[0].toUpperCase(); }

  onMount(() => {
    const handler = (e: any) => {
      const data = e.detail;
      loadConversations();
      if (activeConv && activeConv.id === data.conversation_id) {
        api.getMessages(activeConv.id, false).then(r => { messages = r.messages || []; scrollBottom(); }).catch(() => {});
      }
    };
    window.addEventListener('wisers:new_message', handler);

    const typingHandler = (e: any) => {
      if (!activeConv || e.detail.from !== activeConv.other_username) return;
      typingUser = activeConv.other_display_name || activeConv.other_username || '';
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => { typingUser = ''; }, 3000);
    };
    window.addEventListener('wisers:typing', typingHandler);

    pollInterval = setInterval(() => {
      if ($auth.token && isVisible) loadConversations();
    }, 15000);
    return () => {
      window.removeEventListener('wisers:new_message', handler);
      window.removeEventListener('wisers:typing', typingHandler);
    };
  });

  onDestroy(() => { if (pollInterval) clearInterval(pollInterval); });
</script>

{#if isVisible}
<div class="fdm">
  {#if open}
  <div class="fdm-panel">
    {#if activeConv}
      <div class="fdm-head">
        <button class="fdm-back" aria-label="Back" onclick={() => { activeConv = null; messages = []; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <a href="/wisers/{activeConv.other_username}" class="fdm-head-user" onclick={() => open = false}>
          <div class="fdm-av">{initial(activeConv.other_display_name || activeConv.other_username)}</div>
          <div>
            <div class="fdm-head-name">{activeConv.other_display_name || activeConv.other_username}</div>
            <div class="fdm-head-handle">@{activeConv.other_username}</div>
          </div>
        </a>
        <a href="/wisers/messages?user={activeConv.other_username}" class="fdm-expand" aria-label="Open full chat" onclick={() => open = false}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        </a>
      </div>
      <div class="fdm-messages" bind:this={messagesEl}>
        {#if messages.length === 0}<div class="fdm-empty">No messages yet. Say hi!</div>{/if}
        {#each messages as msg (msg.id)}
          <div class="fdm-msg" class:mine={msg.sender_id === $auth.user?.id}>
            <div class="fdm-msgbubble">{msg.content}</div>
            <span class="fdm-time">{timeAgo(msg.created_at)}</span>
          </div>
        {/each}
        {#if typingUser}
          <div class="fdm-msg">
            <div class="fdm-msgbubble fdm-typing">
              <span class="fdm-dot"></span><span class="fdm-dot"></span><span class="fdm-dot"></span>
            </div>
          </div>
        {/if}
      </div>
      <div class="fdm-input-row">
        <input class="fdm-input" bind:value={newMsg} placeholder="Aa" onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && send()} />
        <button class="fdm-send" aria-label="Send" onclick={send} disabled={!newMsg.trim() || sending}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        </button>
      </div>
    {:else}
      <div class="fdm-head">
        <span class="fdm-head-title">Messages</span>
        <a href="/wisers/messages" class="fdm-expand" aria-label="Open messages" onclick={() => open = false}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        </a>
      </div>
      <div class="fdm-list">
        {#if conversations.length === 0}<div class="fdm-empty">No conversations yet.</div>{/if}
        {#each conversations as conv}
          <button class="fdm-conv" onclick={() => openConv(conv)}>
            <div class="fdm-av">{initial(conv.other_display_name || conv.other_username)}</div>
            <div class="fdm-conv-info">
              <div class="fdm-conv-name">{conv.other_display_name || conv.other_username}</div>
              <div class="fdm-conv-preview">{conv.last_message || 'Start chatting...'}</div>
            </div>
            <div class="fdm-conv-meta">
              <span class="fdm-conv-time">{timeAgo(conv.updated_at)}</span>
              {#if conv.my_unread > 0}<span class="fdm-unread">{conv.my_unread}</span>{/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <button class="fdm-btn" aria-label="Messages" onclick={() => { open = !open; if (open) { loadConversations(); } }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    {#if $wsUnreadDMs > 0}<span class="fdm-badge">{$wsUnreadDMs > 9 ? '9+' : $wsUnreadDMs}</span>{/if}
  </button>
</div>
{/if}

<style>
  .fdm { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
  .fdm-btn { width: 52px; height: 52px; border-radius: 18px; background: #111117; color: #e4e6ea; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 18px rgba(245,166,35,0.45), 0 4px 12px rgba(0,0,0,0.5); position: relative; transition: transform 0.15s; overflow: visible; flex-shrink: 0; }
  .fdm-btn:hover { transform: scale(1.08); }
  .fdm-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 800; min-width: 20px; height: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 5px; border: 2px solid #0a0a0f; pointer-events: none; }
  .fdm-panel { width: 320px; height: 420px; background: #111117; border: 1px solid #1e1e2a; border-radius: 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; }
  .fdm-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #1e1e2a; flex-shrink: 0; }
  .fdm-head-title { font-size: 15px; font-weight: 700; color: #e4e6ea; flex: 1; }
  .fdm-back { background: none; border: none; color: #8a8d91; cursor: pointer; padding: 4px; display: flex; border-radius: 6px; }
  .fdm-back:hover { color: #e4e6ea; background: rgba(255,255,255,0.06); }
  .fdm-head-user { display: flex; align-items: center; gap: 8px; flex: 1; text-decoration: none; }
  .fdm-head-name { font-size: 13px; font-weight: 700; color: #e4e6ea; }
  .fdm-head-handle { font-size: 11px; color: #606770; }
  .fdm-expand { color: #8a8d91; display: flex; padding: 4px; border-radius: 6px; }
  .fdm-expand:hover { color: #f5a623; }
  .fdm-av { width: 34px; height: 34px; border-radius: 50%; background: #f5a623; color: #000; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .fdm-list { flex: 1; overflow-y: auto; }
  .fdm-conv { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: none; background: transparent; color: #e4e6ea; cursor: pointer; width: 100%; text-align: left; font-family: inherit; border-bottom: 1px solid rgba(255,255,255,0.03); }
  .fdm-conv:hover { background: rgba(255,255,255,0.04); }
  .fdm-conv-info { flex: 1; min-width: 0; }
  .fdm-conv-name { font-size: 13px; font-weight: 600; }
  .fdm-conv-preview { font-size: 12px; color: #606770; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  .fdm-conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .fdm-conv-time { font-size: 10px; color: #606770; }
  .fdm-unread { background: #f5a623; color: #000; font-size: 10px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
  .fdm-messages { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .fdm-msg { display: flex; flex-direction: column; align-items: flex-start; }
  .fdm-msg.mine { align-items: flex-end; }
  .fdm-msgbubble { max-width: 75%; padding: 8px 12px; border-radius: 18px; font-size: 13px; background: #1e1e2a; color: #e4e6ea; border-bottom-left-radius: 4px; line-height: 1.4; }
  .fdm-msg.mine .fdm-msgbubble { background: #f5a623; color: #000; border-bottom-left-radius: 18px; border-bottom-right-radius: 4px; }
  .fdm-time { font-size: 10px; color: #606770; margin-top: 2px; }
  .fdm-empty { text-align: center; color: #606770; font-size: 13px; padding: 40px 20px; }
  .fdm-input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #1e1e2a; flex-shrink: 0; }
  .fdm-input { flex: 1; background: #1e1e2a; border: 1px solid #2a2a3a; border-radius: 20px; padding: 8px 14px; color: #e4e6ea; font-size: 13px; outline: none; font-family: inherit; }
  .fdm-input:focus { border-color: #f5a623; }
  .fdm-send { width: 34px; height: 34px; border-radius: 50%; background: #f5a623; color: #000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .fdm-send:disabled { opacity: 0.4; cursor: not-allowed; }
  .fdm-typing { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
  .fdm-dot { width: 6px; height: 6px; border-radius: 50%; background: #8a8d91; animation: fdm-pulse 1s infinite; flex-shrink: 0; }
  .fdm-dot:nth-child(2) { animation-delay: 0.2s; }
  .fdm-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes fdm-pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
</style>
