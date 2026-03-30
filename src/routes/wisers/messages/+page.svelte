<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let conversations = $state<any[]>([]);
  let activeConv = $state<number | null>(null);
  let messages = $state<any[]>([]);
  let newMsg = $state('');
  let loading = $state(true);
  let sending = $state(false);
  let pollInterval: any;
  let newConvUser = $state('');
  let showNewConv = $state(false);

  onMount(async () => {
    await loadConversations();
    loading = false;
    pollInterval = setInterval(async () => {
      await loadConversations();
      if (activeConv) await loadMessages(activeConv);
    }, 5000);
  });

  onDestroy(() => { if (pollInterval) clearInterval(pollInterval); });

  async function loadConversations() {
    try { conversations = (await api.getConversations()).conversations || []; } catch {}
  }

  async function loadMessages(convId: number) {
    try { messages = (await api.getMessages(convId)).messages || []; } catch {}
  }

  async function selectConv(convId: number) {
    activeConv = convId;
    await loadMessages(convId);
    setTimeout(() => {
      const el = document.getElementById('msg-list');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  }

  async function send() {
    if (!newMsg.trim() || sending || !activeConv) return;
    sending = true;
    const conv = conversations.find(c => c.id === activeConv);
    if (conv) {
      try {
        await api.sendMessage(conv.other_username, newMsg.trim());
        newMsg = '';
        await loadMessages(activeConv);
        await loadConversations();
        setTimeout(() => {
          const el = document.getElementById('msg-list');
          if (el) el.scrollTop = el.scrollHeight;
        }, 100);
      } catch {}
    }
    sending = false;
  }

  async function startNewConv() {
    if (!newConvUser.trim()) return;
    try {
      const res = await api.sendMessage(newConvUser.trim(), 'Hey!');
      showNewConv = false;
      newConvUser = '';
      await loadConversations();
      if (res.conversation_id) await selectConv(res.conversation_id);
    } catch (e: any) {
      alert(e.message || 'Could not start conversation');
    }
  }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s/60) + 'm';
    if (s < 86400) return Math.floor(s/3600) + 'h';
    return Math.floor(s/86400) + 'd';
  }

  function getActiveConv() {
    return conversations.find(c => c.id === activeConv);
  }
</script>

<svelte:head><title>Messages — BSCAN Wisers</title></svelte:head>

<div class="dm-page">
  <div class="dm-sidebar">
    <div class="dm-sidebar-header">
      <h2>Messages</h2>
      <button class="btn-new" onclick={() => showNewConv = !showNewConv}>+</button>
    </div>
    {#if showNewConv}
      <div class="new-conv">
        <input type="text" bind:value={newConvUser} placeholder="Username..." onkeydown={(e) => e.key === 'Enter' && startNewConv()} />
        <button onclick={startNewConv}>Go</button>
      </div>
    {/if}
    {#if loading}
      <div class="dm-empty">Loading...</div>
    {:else if conversations.length === 0}
      <div class="dm-empty">No conversations yet</div>
    {:else}
      {#each conversations as conv (conv.id)}
        <button class="conv-item" class:active={activeConv === conv.id} onclick={() => selectConv(conv.id)}>
          <div class="conv-avatar">{(conv.other_display_name || conv.other_name || '?')[0].toUpperCase()}</div>
          <div class="conv-info">
            <div class="conv-name">@{conv.other_username} {#if conv.my_unread > 0}<span class="unread-badge">{conv.my_unread}</span>{/if}</div>
            <div class="conv-preview">{conv.last_message || ''}</div>
          </div>
          {#if conv.last_message_at}<span class="conv-time">{timeAgo(conv.last_message_at)}</span>{/if}
        </button>
      {/each}
    {/if}
  </div>

  <div class="dm-chat">
    {#if !activeConv}
      <div class="dm-placeholder"><p>Select a conversation or start a new one</p></div>
    {:else}
      {#if getActiveConv()}
        <div class="chat-header">
          <a href="/wisers/{getActiveConv().other_username}" class="chat-name">@{getActiveConv().other_username}</a>
          <span class="chat-realname">{getActiveConv().other_display_name || getActiveConv().other_name}</span>
        </div>
      {/if}

      <div class="msg-list" id="msg-list">
        {#each messages as msg (msg.id)}
          <div class="msg" class:msg-mine={msg.sender_id === $auth.user?.id}>
            <div class="msg-bubble">
              {#if msg.sender_id !== $auth.user?.id}
                <span class="msg-author">@{msg.username}</span>
              {/if}
              <div class="msg-text">{msg.content}</div>
              <span class="msg-time">{timeAgo(msg.created_at)}</span>
            </div>
          </div>
        {/each}
      </div>

      <div class="chat-input">
        <input type="text" bind:value={newMsg} placeholder="Type a message..." onkeydown={(e) => e.key === 'Enter' && send()} />
        <button onclick={send} disabled={sending || !newMsg.trim()}>Send</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .dm-page { display: flex; height: calc(100vh - 70px); max-width: 1000px; margin: 0 auto; border: 1px solid var(--clr-border, #2a2a3e); border-radius: 12px; overflow: hidden; margin-top: 16px; }
  .dm-sidebar { width: 300px; border-right: 1px solid var(--clr-border); background: var(--clr-bg-card, #1a1a2e); overflow-y: auto; flex-shrink: 0; }
  .dm-sidebar-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--clr-border); }
  .dm-sidebar-header h2 { font-size: 16px; font-weight: 700; }
  .btn-new { width: 28px; height: 28px; border-radius: 50%; border: none; background: var(--clr-gold, #f5a623); color: #000; font-size: 16px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .new-conv { display: flex; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--clr-border); }
  .new-conv input { flex: 1; padding: 6px 10px; border: 1px solid var(--clr-border); border-radius: 6px; background: var(--clr-bg-deep); color: var(--clr-text); font-size: 12px; outline: none; }
  .new-conv button { padding: 6px 12px; border: none; background: var(--clr-gold); color: #000; font-weight: 700; font-size: 11px; border-radius: 6px; cursor: pointer; }
  .conv-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: none; border-bottom: 1px solid rgba(255,255,255,0.03); background: transparent; color: var(--clr-text); cursor: pointer; width: 100%; text-align: left; }
  .conv-item:hover { background: rgba(255,255,255,0.03); }
  .conv-item.active { background: rgba(245,166,35,0.08); border-left: 3px solid var(--clr-gold); }
  .conv-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--clr-gold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; }
  .conv-info { flex: 1; min-width: 0; }
  .conv-name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .conv-preview { font-size: 11px; color: var(--clr-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .conv-time { font-size: 10px; color: var(--clr-text-muted); flex-shrink: 0; }
  .unread-badge { font-size: 10px; background: var(--clr-gold); color: #000; padding: 1px 6px; border-radius: 99px; font-weight: 800; }
  .dm-chat { flex: 1; display: flex; flex-direction: column; background: var(--clr-bg-deep, #0d0d1a); }
  .dm-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--clr-text-muted); font-size: 14px; }
  .chat-header { padding: 14px 16px; border-bottom: 1px solid var(--clr-border); display: flex; align-items: center; gap: 8px; }
  .chat-name { font-weight: 700; color: var(--clr-gold); text-decoration: none; font-size: 14px; }
  .chat-realname { font-size: 12px; color: var(--clr-text-muted); }
  .msg-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .msg { display: flex; }
  .msg-mine { justify-content: flex-end; }
  .msg-bubble { max-width: 70%; padding: 10px 14px; border-radius: 14px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); }
  .msg-mine .msg-bubble { background: rgba(245,166,35,0.12); border-color: rgba(245,166,35,0.25); }
  .msg-author { font-size: 10px; font-weight: 700; color: var(--clr-gold); display: block; margin-bottom: 2px; }
  .msg-text { font-size: 13px; color: var(--clr-text); line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
  .msg-time { font-size: 9px; color: var(--clr-text-muted); margin-top: 4px; display: block; }
  .msg-mine .msg-time { text-align: right; }
  .chat-input { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--clr-border); }
  .chat-input input { flex: 1; padding: 10px 14px; border: 1px solid var(--clr-border); border-radius: 10px; background: var(--clr-bg-card); color: var(--clr-text); font-size: 13px; outline: none; }
  .chat-input input:focus { border-color: var(--clr-gold); }
  .chat-input button { padding: 10px 20px; border: none; background: var(--clr-gold); color: #000; font-weight: 700; font-size: 12px; border-radius: 10px; cursor: pointer; }
  .chat-input button:disabled { opacity: 0.4; }
  .dm-empty { padding: 24px; text-align: center; font-size: 12px; color: var(--clr-text-muted); }
  @media (max-width: 640px) {
    .dm-page { flex-direction: column; height: auto; }
    .dm-sidebar { width: 100%; max-height: 300px; border-right: none; border-bottom: 1px solid var(--clr-border); }
    .dm-chat { min-height: 400px; }
  }
</style>
