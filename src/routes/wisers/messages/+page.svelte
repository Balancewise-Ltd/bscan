<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { wsUnreadDMs, wsConnected as wsConnectedStore, markConvRead, fetchUnreadCounts, connectWS, sendTyping } from '$lib/stores/wisers-ws';
  import { page } from '$app/stores';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let conversations = $state<any[]>([]);
  let friendsList = $state<any[]>([]);
  let showNewChat = $state(false);
  let searchQuery = $state('');
  let typingUser = $state('');
  let typingTimeout: any = null;
  let lastTypingSent = 0;
  let activeConv = $state<number | null>(null);
  let messages = $state<any[]>([]);
  let newMsg = $state('');
  let loading = $state(true);
  let sending = $state(false);
  let showEmoji = $state(false);
  const emojis = ['😀','😂','🤣','😍','🥰','😎','🤩','🥳','😭','😤','🔥','💯','👏','🙌','💪','🚀','⭐','💡','✅','❌','👀','💬','❤️','💙','💚','💛','🧡','💜','🖤','🤍','👍','👎','🎉','🎊','🏆','💎','🌟','⚡','🎯','🔑','🛠️','💻','🌐','🤖','🧠','💭','✨','🙏','🤝','👋','✌️','🤞'];
  let pollInterval: any;
  let wsHandler: any;
  let typingHandler: ((e: any) => void) | null = null;
  let newConvUser = $state('');
  let showNewConv = $state(false);
  let theme = $state<'dark' | 'light'>('dark');
  const filteredConvs = $derived(
    searchQuery.trim()
      ? conversations.filter(c =>
          (c.other_username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.other_display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : conversations
  );

  onMount(async () => {
    if ($auth.token) { connectWS($auth.token); fetchUnreadCounts($auth.token); }
    if (typeof document !== 'undefined') document.body.classList.add('wisers-page');
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; document.documentElement.setAttribute('data-wisers-theme', 'light'); }
    await loadConversations();
    loading = false;

    wsHandler = (e: any) => {
      const data = e.detail;
      loadConversations();
      if (activeConv) { loadMessages(activeConv); scrollBottom(); }
    };
    window.addEventListener('wisers:new_message', wsHandler);

    typingHandler = (e: any) => {
      const conv = conversations.find(c => c.id === activeConv);
      if (conv && e.detail.from) {
        typingUser = conv.other_display_name || conv.other_username || '';
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { typingUser = ''; }, 3000);
      }
    };
    window.addEventListener('wisers:typing', typingHandler);

    const dmUser = $page.url.searchParams.get('user');
    if (dmUser) await startChatWith(dmUser);
    pollInterval = setInterval(async () => {
      await loadConversations();
      if (activeConv && !$wsConnectedStore) await loadMessages(activeConv);
    }, $wsConnectedStore ? 30000 : 5000);
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') document.body.classList.remove('wisers-page');
    if (pollInterval) clearInterval(pollInterval);
    if (wsHandler) window.removeEventListener('wisers:new_message', wsHandler);
    if (typingHandler) window.removeEventListener('wisers:typing', typingHandler);
    if (typingTimeout) clearTimeout(typingTimeout);
  });





  async function handleMarkUnread(e: MouseEvent, conv: any) {
    e.stopPropagation();
    if (conv.my_unread > 0) return;
    try {
      await api.markConvUnread(conv.id);
      conv.my_unread = 1;
      wsUnreadDMs.update(n => n + 1);
    } catch {}
  }

  function scrollBottom() {
    setTimeout(() => { const el = document.getElementById('msg-scroll'); if (el) el.scrollTop = el.scrollHeight; }, 150);
  }

  async function loadConversations() {
    try { conversations = (await api.getConversations()).conversations || []; } catch {}
    try { friendsList = (await api.getFriends()).friends || []; } catch {}
  }

  async function loadMessages(convId: number) {
    try { messages = (await api.getMessages(convId, true)).messages || []; scrollBottom(); } catch {}
  }

  async function selectConv(convId: number) {
    activeConv = convId;
    await loadMessages(convId);
    const conv = conversations.find((c: any) => c.id === convId);
    if (conv && $auth.token) markConvRead($auth.token, convId, conv.unread || 0);
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
      } catch {}
    }
    sending = false;
  }

  async function startNewConv() {
    if (!newConvUser.trim()) return;
    try {
      const res = await api.openConversation(newConvUser.trim());
      showNewConv = false; newConvUser = '';
      await loadConversations();
      if (res.conversation_id) await selectConv(res.conversation_id);
    } catch (e: any) { alert(e.message || 'Could not start conversation'); }
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-wisers-theme', theme);
    localStorage.setItem('wisers-theme', theme);
  }

  function timeAgo(d: string) {
    if (!d) return '';
    const date = new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z');
    const now = new Date();
    const s = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function timeFull(d: string) {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function initial(name: string) { return (name || '?')[0].toUpperCase(); }
  function getActiveConv() { return conversations.find(c => c.id === activeConv); }

  async function startChatWith(username: string) {
    try {
      const res = await api.openConversation(username);
      conversations = (await api.getConversations()).conversations || [];
      await selectConv(res.conversation_id);
    } catch (e) {
      console.error('Failed to open chat', e);
    }
  }
</script>

<svelte:head>
  <title>Messages — Wisers</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="m" class:light={theme === 'light'}>
  <!-- Top bar -->
  <header class="m-top">
    <a href="/wisers" class="m-back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <a href="/wisers" class="m-logo">W<span>isers</span></a>
    <h1 class="m-title">Messages</h1>
    <div class="m-top-right">
      {#if $wsConnectedStore}<span class="m-live" title="Live connection"></span>{/if}
      <button class="m-theme-btn" onclick={toggleTheme}>
        {#if theme === 'dark'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        {/if}
      </button>
    </div>
  </header>

  <div class="m-body">
    <!-- Conversations sidebar -->
    <div class="m-convos">
      <div class="m-convos-header">
        <input type="text" class="m-convos-search" placeholder="Search conversations..." bind:value={searchQuery} />
        <button class="m-new-btn" onclick={() => showNewConv = !showNewConv} title="New message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {#if showNewConv}
        <div class="m-new-conv">
          <input type="text" bind:value={newConvUser} placeholder="Enter username..." onkeydown={(e) => e.key === 'Enter' && startNewConv()} />
          <button onclick={startNewConv}>Start</button>
        </div>
      {/if}

      <div class="m-convos-list">
        {#if loading}
          <div class="m-empty-conv">Loading...</div>
        {:else if conversations.length === 0}
          <div class="m-empty-conv">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>No conversations yet</p>
          {#if friendsList.length > 0}
            <p style="font-size: 13px; margin-top: 8px;">Start chatting with a friend:</p>
            {#each friendsList as f}
              <button class="m-friend-btn" onclick={() => { startChatWith(f.username); showNewChat = false; }}>
                <span class="m-friend-avatar">{(f.display_name || f.username || '?')[0].toUpperCase()}</span>
                <span>{f.display_name || f.username}</span>
              </button>
            {/each}
          {/if}
          <p style="display:none"></p>
            <p class="m-empty-sub">Message a friend to get started</p>
          </div>
        {:else}
          {#each filteredConvs as conv (conv.id)}
            <!-- svelte-ignore a11y_interactive_supports_focus -->
            <div class="m-conv" class:active={activeConv === conv.id} role="button" tabindex="0" onclick={() => selectConv(conv.id)} onkeydown={(e) => e.key === 'Enter' && selectConv(conv.id)}>
              <div class="m-conv-avatar">{initial(conv.other_display_name || conv.other_name)}</div>
              <div class="m-conv-body">
                <div class="m-conv-top">
                  <span class="m-conv-name">@{conv.other_username}</span>
                  {#if conv.last_message_at}<span class="m-conv-time">{timeAgo(conv.last_message_at)}</span>{/if}
                </div>
                <div class="m-conv-preview">
                  {conv.last_message || 'Start chatting...'}
                </div>
              </div>
              {#if conv.my_unread > 0}<span class="m-conv-badge">{conv.my_unread}</span>{/if}
              <button class="m-conv-action" title={conv.my_unread > 0 ? "Already unread" : "Mark as unread"} onclick={async (e) => {
                e.stopPropagation();
                if (conv.my_unread > 0) return;
                try {
                  await api.markConvUnread(conv.id);
                  conv.my_unread = 1;
                  wsUnreadDMs.update(n => n + 1);
                } catch {}
              }}>
                {#if conv.my_unread > 0}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f5a623" stroke="none"><circle cx="12" cy="12" r="5"/></svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/></svg>
                {/if}
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Chat area -->
    <div class="m-chat">
      {#if !activeConv}
        <div class="m-chat-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.15"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <h2>Your messages</h2>
          <p>Select a conversation or start a new one</p>
        </div>
      {:else}
        <!-- Chat header -->
        {#if getActiveConv()}
          <div class="m-chat-header">
            <a href="/wisers/{getActiveConv().other_username}" class="m-chat-user">
              <div class="m-conv-avatar">{initial(getActiveConv().other_display_name || getActiveConv().other_name)}</div>
              <div>
                <div class="m-chat-name">@{getActiveConv().other_username}</div>
                <div class="m-chat-real">{getActiveConv().other_display_name || getActiveConv().other_name}</div>
              </div>
            </a>
          </div>
        {/if}

        <!-- Messages -->
        <div class="m-messages" id="msg-scroll">
          {#if messages.length === 0}
            <div class="m-msg-empty">Start the conversation! Say hi.</div>
          {/if}
          {#each messages as msg (msg.id)}
            <div class="m-msg" class:mine={msg.sender_id === $auth.user?.id}>
              <div class="m-msg-bubble">
                <div class="m-msg-text">{msg.content}</div>
                <span class="m-msg-time">
                  {timeFull(msg.created_at)}
                  {#if msg.sender_id === $auth.user?.id}
                    {#if msg.read_at}<span class="m-tick m-tick-read">✓✓</span>{:else}<span class="m-tick">✓</span>{/if}
                  {/if}
                </span>
              </div>
            </div>
          {/each}
        </div>

        {#if typingUser}<div class="m-typing"><span class="m-typing-dots"></span> {typingUser} is typing...</div>{/if}
        <!-- Input -->
        <div class="m-input-bar">
          <div class="m-emoji-wrap">
          <button class="m-emoji-btn" onclick={() => showEmoji = !showEmoji} type="button">😀</button>
          {#if showEmoji}
            <div class="m-emoji-picker">
              {#each emojis as e}
                <button class="m-emoji-item" onclick={() => { newMsg += e; showEmoji = false; }} type="button">{e}</button>
              {/each}
            </div>
          {/if}
        </div>
        <input type="text" class="m-input" bind:value={newMsg} placeholder="Type a message..."
            onkeydown={(e) => e.key === 'Enter' && send()}
            oninput={() => {
              const now = Date.now();
              if (now - lastTypingSent > 2000) {
                const conv = conversations.find(c => c.id === activeConv);
                if (conv) {
                  const otherId = conv.user_a === $auth.user?.id ? conv.user_b : conv.user_a;
                  if (otherId) sendTyping(otherId);
                }
                lastTypingSent = now;
              }
            }} />
          <button class="m-send" onclick={send} disabled={sending || !newMsg.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

  .m { --mb: #0a0a0f; --mc: #111117; --mt: #e4e6ea; --mt2: #8a8d91; --mt3: #606770; --mbd: #1e1e2a; --mcard: #16161f; --mgold: #f5a623; --mhover: rgba(255,255,255,0.04); --mmine: rgba(245,166,35,0.12); --mmine-bd: rgba(245,166,35,0.25);
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--mt); background: var(--mb); height: calc(100vh - 56px); display: flex; flex-direction: column; overflow: hidden; }
  .m.light { --mb: #ffffff; --mc: #f0f2f5; --mt: #1c1e21; --mt2: #606770; --mt3: #8a8d91; --mbd: #dddfe2; --mcard: #ffffff; --mgold: #d4a017; --mhover: rgba(0,0,0,0.04); --mmine: rgba(245,166,35,0.08); --mmine-bd: rgba(245,166,35,0.2); }

  .m-top { display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 52px; background: var(--mcard); border-bottom: 1px solid var(--mbd); flex-shrink: 0; }
  .m-back { color: var(--mt2); display: flex; }
  .m-back:hover { color: var(--mt); }
  .m-logo { font-size: 20px; font-weight: 800; color: var(--mgold); text-decoration: none; letter-spacing: -1px; }
  .m-logo span { color: var(--mt); }
  .m-title { font-size: 15px; font-weight: 600; margin-left: 8px; }
  .m-top-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .m-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
  .m-theme-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--mc); color: var(--mt2); display: flex; align-items: center; justify-content: center; cursor: pointer; }

  .m-body { display: flex; flex: 1; overflow: hidden; }

  .m-convos { width: 340px; border-right: 1px solid var(--mbd); display: flex; flex-direction: column; background: var(--mcard); flex-shrink: 0; }
  .m-convos-header { display: flex; align-items: center; gap: 8px; padding: 12px; border-bottom: 1px solid var(--mbd); }
  .m-convos-search { flex: 1; padding: 8px 14px; border-radius: 20px; border: none; background: var(--mc); color: var(--mt); font-size: 13px; outline: none; font-family: inherit; }
  .m-convos-search::placeholder { color: var(--mt3); }
  .m-new-btn { width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--mgold); color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .m-new-conv { display: flex; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--mbd); }
  .m-new-conv input { flex: 1; padding: 6px 12px; border-radius: 16px; border: 1px solid var(--mbd); background: var(--mc); color: var(--mt); font-size: 12px; outline: none; font-family: inherit; }
  .m-new-conv button { padding: 6px 14px; border-radius: 16px; border: none; background: var(--mgold); color: #000; font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit; }

  .m-convos-list { flex: 1; overflow-y: auto; }
  .m-empty-conv { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: var(--mt3); font-size: 13px; gap: 8px; height: 100%; }
  .m-empty-sub { font-size: 11px; }

  .m-conv { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-bottom: 1px solid rgba(255,255,255,0.02); background: transparent; color: var(--mt); cursor: pointer; width: 100%; text-align: left; font-family: inherit; position: relative; }
  .m-conv:hover { background: var(--mhover); }
  .m-conv.active { background: rgba(245,166,35,0.06); }
  .m-conv-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--mgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; flex-shrink: 0; }
  .m-conv-body { flex: 1; min-width: 0; }
  .m-conv-top { display: flex; justify-content: space-between; align-items: center; }
  .m-conv-name { font-size: 14px; font-weight: 600; }
  .m-conv-time { font-size: 11px; color: var(--mt3); }
  .m-conv-preview { font-size: 12px; color: var(--mt2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .m-conv-action { background: none; border: none; color: var(--mt3); cursor: pointer; padding: 4px; border-radius: 50%; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
  .m-conv:hover .m-conv-action { opacity: 1; }
  .m-conv-action:hover { color: var(--mgold); background: var(--mhover); }
  .m-conv-badge { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 10px; background: var(--mgold); color: #000; padding: 2px 7px; border-radius: 99px; font-weight: 800; }

  .m-chat { flex: 1; display: flex; flex-direction: column; background: var(--mb); min-height: 0; }
  .m-chat-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; }
  .m-chat-empty h2 { font-size: 20px; font-weight: 700; }
  .m-chat-empty p { color: var(--mt3); font-size: 14px; }

  .m-chat-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--mbd); background: var(--mcard); }
  .m-chat-user { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--mt); }
  .m-chat-user:hover .m-chat-name { text-decoration: underline; }
  .m-chat-name { font-size: 14px; font-weight: 700; }
  .m-chat-real { font-size: 11px; color: var(--mt2); }

  .m-messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
  .m-msg-empty { text-align: center; color: var(--mt3); font-size: 13px; padding: 40px; }
  .m-msg { display: flex; }
  .m-msg.mine { justify-content: flex-end; }
  .m-msg-bubble { max-width: 65%; padding: 10px 14px; border-radius: 18px; background: var(--mcard); border: 1px solid var(--mbd); }
  .m-msg.mine .m-msg-bubble { background: var(--mmine); border-color: var(--mmine-bd); border-bottom-right-radius: 4px; }
  .m-msg:not(.mine) .m-msg-bubble { border-bottom-left-radius: 4px; }
  .m-msg-text { font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
  .m-msg-time { font-size: 10px; color: var(--mt3); display: block; margin-top: 4px; }
  .m-msg.mine .m-msg-time { text-align: right; }
  .m-tick { margin-left: 4px; color: var(--mt3); font-size: 10px; }
  .m-tick-read { color: #3b82f6; }
  .m-typing { padding: 4px 20px 6px; font-size: 12px; color: var(--mt3); font-style: italic; min-height: 24px; }
  .m-typing-dots::after { content: '●●●'; letter-spacing: -2px; animation: typeDots 1.2s infinite; margin-right: 6px; font-style: normal; font-size: 8px; }
  @keyframes typeDots { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

  .m-input-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--mbd); background: var(--mcard); flex-shrink: 0; }
  .m-emoji-wrap { position: relative; }
  .m-emoji-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
  .m-emoji-btn:hover { background: var(--mhover); }
  .m-emoji-picker { position: absolute; bottom: 44px; left: 0; background: var(--mcard); border: 1px solid var(--mbd); border-radius: 12px; padding: 8px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; width: 280px; max-height: 200px; overflow-y: auto; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .m-emoji-item { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 6px; text-align: center; }
  .m-emoji-item:hover { background: var(--mhover); }
  .m-input { flex: 1; padding: 12px 18px; border-radius: 24px; border: 1px solid var(--mbd); background: var(--mc); color: var(--mt); font-size: 14px; outline: none; font-family: inherit; }
  .m-input:focus { border-color: var(--mgold); }
  .m-input::placeholder { color: var(--mt3); }
  .m-send { width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--mgold); color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .m-send:disabled { opacity: 0.3; cursor: not-allowed; }
  .m-send:hover:not(:disabled) { filter: brightness(1.1); }

  @media (max-width: 640px) {
    .m-convos { width: 100%; }
    .m-chat { display: none; }
    .m-convos:has(+ .m-chat .m-chat-header) { display: none; }
  }
  .m-friend-btn { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: var(--wt, #e8e6e3); cursor: pointer; width: 100%; margin-top: 6px; font-family: inherit; font-size: 13px; }
  .m-friend-btn:hover { background: rgba(245,166,35,0.1); border-color: rgba(245,166,35,0.3); }
  .m-friend-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e8941a); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #000; flex-shrink: 0; }
</style>