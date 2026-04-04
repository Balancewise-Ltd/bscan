<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { wsUnreadDMs, wsConnected as wsConnectedStore, wsLastMessage, markConvRead, fetchUnreadCounts, connectWS, sendTyping } from '$lib/stores/wisers-ws';
  import { page } from '$app/stores';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';
  import { timeAgo } from '$lib/utils/time';
  import { hasKeyPair, generateAndStoreKeyPair, uploadPublicKey, fetchAndCachePublicKey, encryptMessage, decryptMessage } from '$lib/stores/encryption';

  let conversations = $state<any[]>([]);
  let e2eActive = $state(false);
  let recipientPubKey = $state<Uint8Array | null>(null);
  let friendsList = $state<any[]>([]);
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
  let attachment = $state<any>(null);
  let uploading = $state(false);
  let fileInput: HTMLInputElement | undefined = $state(undefined);
  let readStatusMap = $state<Record<number, string>>({}); // msg_id → read_at
  let msgObserver: IntersectionObserver | null = null;
  let activeTab = $state<'chats' | 'requests'>('chats');
  let messageRequests = $state<any[]>([]);
  let loadingRequests = $state(false);
  const filteredConvs = $derived(
    searchQuery.trim()
      ? conversations.filter(c =>
          (c.other_username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.other_display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : conversations
  );

  // X-standard: complete message via WS, dedup, no reload
  $effect(() => {
    const msg = $wsLastMessage;
    if (!msg || !msg.sender_id || !msg.content) return;
    untrack(() => {
      loadConversations();
      if (activeConv && String(msg.conversation_id) === String(activeConv)) {
        const isDupe = messages.some(m => m.id === msg.id);
        if (!isDupe) {
          messages = [...messages, {
            id: msg.id || Date.now(),
            sender_id: msg.sender_id,
            content: msg.content,
            created_at: msg.created_at || new Date().toISOString(),
            read_at: msg.read_at || null,
            username: msg.username || '',
            display_name: msg.display_name || '',
            user_name: msg.user_name || ''
          }];
          scrollBottom();
          // Observe the new message for read marking
          setTimeout(() => {
            if (msgObserver) {
              const container = document.getElementById('msg-scroll');
              const newEl = container?.querySelector(`[data-msg-id="${msg.id || Date.now()}"]`);
              if (newEl) msgObserver.observe(newEl);
            }
          }, 200);
        }
      }
    });
  });

  onMount(async () => {
    if ($auth.token) {
      connectWS($auth.token);
      fetchUnreadCounts($auth.token);
      // E2E: generate keypair on first use
      if (!hasKeyPair()) {
        generateAndStoreKeyPair();
        await uploadPublicKey($auth.token);
      }
    }
    if (typeof document !== 'undefined') document.body.classList.add('wisers-page');
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; document.documentElement.setAttribute('data-wisers-theme', 'light'); }
    await loadConversations();
    await loadMessageRequests();
    loading = false;

    // wsLastMessage store drives real-time updates via $effect (below onMount)

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
    // wsHandler replaced by $effect — no manual cleanup needed
    if (typingHandler) window.removeEventListener('wisers:typing', typingHandler);
    if (typingTimeout) clearTimeout(typingTimeout);
    if (msgObserver) { msgObserver.disconnect(); msgObserver = null; }
  });





  function scrollBottom() {
    setTimeout(() => { const el = document.getElementById('msg-scroll'); if (el) el.scrollTop = el.scrollHeight; }, 150);
  }

  async function loadConversations() {
    try { conversations = (await api.getConversations()).conversations || []; } catch {}
    try { friendsList = (await api.getFriends()).friends || []; } catch {}
  }

  async function loadMessageRequests() {
    loadingRequests = true;
    try { messageRequests = (await api.getMessageRequests()).requests || []; } catch {}
    loadingRequests = false;
  }

  async function acceptRequest(conv: any) {
    activeTab = 'chats';
    await selectConv(conv.id);
  }

  async function declineRequest(conv: any) {
    try {
      await api.blockUser(conv.other_username);
      messageRequests = messageRequests.filter(r => r.id !== conv.id);
    } catch {}
  }

  async function loadMessages(convId: number) {
    try { messages = (await api.getMessages(convId, true)).messages || []; scrollBottom(); } catch {}
  }

  async function selectConv(convId: number) {
    activeConv = convId;
    // Tear down previous observer
    if (msgObserver) { msgObserver.disconnect(); msgObserver = null; }
    await loadMessages(convId);
    const conv = conversations.find((c: any) => c.id === convId);
    if (conv && $auth.token) {
      markConvRead($auth.token, convId, conv.my_unread || 0);
      // Fetch accurate read status for ✓✓
      try {
        const rs = await api.getReadStatus(convId);
        const map: Record<number, string> = {};
        if (rs && Array.isArray(rs.statuses)) {
          for (const s of rs.statuses) { if (s.read_at) map[s.message_id] = s.read_at; }
        }
        readStatusMap = map;
      } catch { readStatusMap = {}; }
      // Set up IntersectionObserver to mark unread messages as read
      setupReadObserver(convId);
      // E2E: fetch recipient's public key
      const otherId = conv.user_a === $auth.user?.id ? conv.user_b : conv.user_a;
      if (otherId && hasKeyPair()) {
        recipientPubKey = await fetchAndCachePublicKey(otherId, $auth.token);
        e2eActive = !!recipientPubKey;
      } else {
        recipientPubKey = null;
        e2eActive = false;
      }
    }
  }

  function setupReadObserver(convId: number) {
    if (typeof IntersectionObserver === 'undefined') return;
    msgObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const msgId = parseInt(el.dataset.msgId || '0', 10);
        if (!msgId) continue;
        // Only mark others' messages (not mine)
        const senderId = el.dataset.senderId || '';
        if (senderId === $auth.user?.id) continue;
        // Already read? skip
        if (readStatusMap[msgId]) continue;
        // Mark read
        api.markMessageRead(msgId).then(() => {
          readStatusMap = { ...readStatusMap, [msgId]: new Date().toISOString() };
        }).catch(() => {});
        // Stop observing once marked
        msgObserver?.unobserve(el);
      }
    }, { threshold: 0.5 });
    // Observe after a tick so DOM is ready
    setTimeout(() => {
      const container = document.getElementById('msg-scroll');
      if (!container) return;
      const msgEls = container.querySelectorAll('[data-msg-id]');
      msgEls.forEach(el => msgObserver?.observe(el));
    }, 200);
  }

  async function send() {
    if ((!newMsg.trim() && !attachment) || sending || !activeConv) return;
    sending = true;
    const conv = conversations.find(c => c.id === activeConv);
    if (conv) {
      try {
        let content = newMsg.trim();
        let encryptedContent: string | undefined;
        let nonce: string | undefined;
        // E2E: encrypt if both parties have keys
        if (e2eActive && recipientPubKey && content) {
          const enc = encryptMessage(content, recipientPubKey);
          if (enc) {
            encryptedContent = enc.encrypted;
            nonce = enc.nonce;
          }
        }
        await api.sendMessage(conv.other_username, content, attachment?.id, encryptedContent, nonce);
        newMsg = '';
        attachment = null;
        await loadMessages(activeConv);
        await loadConversations();
      } catch {}
    }
    sending = false;
  }

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    uploading = true;
    try {
      const res = await api.uploadMedia(file);
      attachment = res;
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    }
    uploading = false;
    if (target) target.value = '';
  }

  function removeAttachment() {
    attachment = null;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
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

  <div class="m-body" class:has-active={activeConv !== null}>
    <!-- Conversations sidebar -->
    <div class="m-convos">
      <div class="m-convos-header">
        <input type="text" class="m-convos-search" placeholder="Search conversations..." bind:value={searchQuery} />
        <button class="m-new-btn" onclick={() => showNewConv = !showNewConv} title="New message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="m-tabs">
        <button class="m-tab" class:active={activeTab === 'chats'} onclick={() => activeTab = 'chats'}>Chats</button>
        <button class="m-tab" class:active={activeTab === 'requests'} onclick={() => { activeTab = 'requests'; loadMessageRequests(); }}>
          Requests{#if messageRequests.length > 0}<span class="m-tab-badge">{messageRequests.length}</span>{/if}
        </button>
      </div>

      {#if showNewConv}
        <div class="m-new-conv">
          <input type="text" bind:value={newConvUser} placeholder="Enter username..." onkeydown={(e) => e.key === 'Enter' && startNewConv()} />
          <button onclick={startNewConv}>Start</button>
        </div>
      {/if}

      <div class="m-convos-list">
        {#if activeTab === 'requests'}
          {#if loadingRequests}
            <div class="m-empty-conv">Loading requests...</div>
          {:else if messageRequests.length === 0}
            <div class="m-empty-conv">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              <p>No message requests</p>
              <p class="m-empty-sub">Messages from people you don't follow will appear here</p>
            </div>
          {:else}
            {#each messageRequests as req (req.id)}
              <div class="m-conv m-conv-request">
                <div class="m-conv-avatar">{(req.other_display_name || req.other_username || '?')[0].toUpperCase()}</div>
                <div class="m-conv-body">
                  <div class="m-conv-top">
                    <span class="m-conv-name">@{req.other_username}</span>
                    {#if req.last_message_at}<span class="m-conv-time">{timeAgo(req.last_message_at)}</span>{/if}
                  </div>
                  <div class="m-conv-preview">{req.last_message || 'Wants to message you'}</div>
                  <div class="m-req-actions">
                    <button class="m-req-accept" onclick={() => acceptRequest(req)}>Accept</button>
                    <button class="m-req-decline" onclick={() => declineRequest(req)}>Decline</button>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        {:else if loading}
          <div class="m-empty-conv">Loading...</div>
        {:else if conversations.length === 0}
          <div class="m-empty-conv">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>No conversations yet</p>
          {#if friendsList.length > 0}
            <p style="font-size: 15px; margin-top: 8px;">Start chatting with a friend:</p>
            {#each friendsList as f}
              <button class="m-friend-btn" onclick={() => { startChatWith(f.username); }}>
                <span class="m-friend-avatar">{(f.display_name || f.username || '?')[0].toUpperCase()}</span>
                <span>{f.display_name || f.username}</span>
              </button>
            {/each}
          {/if}
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
              <button class="m-conv-action" title={conv.my_unread > 0 ? "Mark as read" : "Mark as unread"} onclick={async (e) => {
                e.stopPropagation();
                try {
                  if (conv.my_unread > 0) {
                    await api.markConvRead(conv.id);
                    wsUnreadDMs.update(n => Math.max(0, n - conv.my_unread));
                    conversations = conversations.map(c => c.id === conv.id ? { ...c, my_unread: 0 } : c);
                  } else {
                    await api.markConvUnread(conv.id);
                    conversations = conversations.map(c => c.id === conv.id ? { ...c, my_unread: 1 } : c);
                    wsUnreadDMs.update(n => n + 1);
                  }
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
            <button class="m-chat-back" onclick={() => { activeConv = null; messages = []; }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <a href="/wisers/{getActiveConv().other_username}" class="m-chat-user">
              <div class="m-conv-avatar">{initial(getActiveConv().other_display_name || getActiveConv().other_name)}</div>
              <div>
                <div class="m-chat-name">@{getActiveConv().other_username} {#if e2eActive}<span class="m-e2e-lock" title="End-to-end encrypted">&#x1f512;</span>{/if}</div>
                <div class="m-chat-real">{getActiveConv().other_display_name || getActiveConv().other_name}{#if e2eActive}<span class="m-e2e-badge">End-to-end encrypted</span>{/if}</div>
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
            <div class="m-msg" class:mine={msg.sender_id === $auth.user?.id} data-msg-id={msg.id} data-sender-id={msg.sender_id}>
              <div class="m-msg-bubble">
                {#if msg.attachment}
                  <div class="m-msg-attachment">
                    {#if msg.attachment.type === 'image'}
                      <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.attachment.thumbnail_url || msg.attachment.url} alt={msg.attachment.filename || 'Image'} class="m-msg-img" />
                      </a>
                    {:else if msg.attachment.type === 'video'}
                      <!-- svelte-ignore a11y_media_has_caption -->
                      <video src={msg.attachment.url} controls class="m-msg-video" preload="metadata"></video>
                    {:else if msg.attachment.type === 'audio'}
                      <div class="m-msg-audio-wrap">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <audio src={msg.attachment.url} controls class="m-msg-audio" preload="metadata"></audio>
                      </div>
                    {:else}
                      <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" class="m-msg-doc">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div class="m-msg-doc-info">
                          <span class="m-msg-doc-name">{msg.attachment.filename || 'File'}</span>
                          {#if msg.attachment.size}<span class="m-msg-doc-size">{formatFileSize(msg.attachment.size)}</span>{/if}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    {/if}
                  </div>
                {/if}
                {#if msg.encrypted_content && msg.nonce && recipientPubKey}
                  {@const dec = decryptMessage(msg.encrypted_content, msg.nonce, recipientPubKey)}
                  <div class="m-msg-text">{dec || '[Encrypted message]'}</div>
                {:else if msg.content}<div class="m-msg-text">{msg.content}</div>{/if}
                <span class="m-msg-time">
                  {timeFull(msg.created_at)}
                  {#if msg.sender_id === $auth.user?.id}
                    {#if msg.read_at || readStatusMap[msg.id]}<span class="m-tick m-tick-read">✓✓</span>{:else}<span class="m-tick">✓</span>{/if}
                  {/if}
                </span>
              </div>
            </div>
          {/each}
        </div>

        {#if typingUser}<div class="m-typing"><span class="m-typing-dots"></span> {typingUser} is typing...</div>{/if}
        <!-- Attachment preview -->
        {#if uploading}
          <div class="m-attach-preview">
            <div class="m-attach-uploading">
              <div class="m-attach-spinner"></div>
              <span>Uploading...</span>
            </div>
          </div>
        {/if}
        {#if attachment}
          <div class="m-attach-preview">
            <div class="m-attach-card">
              {#if attachment.type === 'image'}
                <img src={attachment.thumbnail_url || attachment.url} alt={attachment.filename} class="m-attach-thumb" />
              {:else if attachment.type === 'video'}
                <div class="m-attach-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              {:else if attachment.type === 'audio'}
                <div class="m-attach-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
              {:else}
                <div class="m-attach-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
              {/if}
              <div class="m-attach-info">
                <span class="m-attach-name">{attachment.filename}</span>
                <span class="m-attach-size">{formatFileSize(attachment.size)}</span>
              </div>
              <button class="m-attach-remove" onclick={removeAttachment} type="button" title="Remove attachment">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        {/if}
        <!-- Input -->
        <div class="m-input-bar">
          <input type="file" class="m-file-input" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" bind:this={fileInput} onchange={handleFileSelect} />
          <button class="m-attach-btn" onclick={() => fileInput?.click()} type="button" title="Attach file" disabled={uploading}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
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
                  if (otherId) sendTyping(otherId, conv.id);
                }
                lastTypingSent = now;
              }
            }} />
          <button class="m-send" onclick={send} disabled={sending || (!newMsg.trim() && !attachment)}>
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
  .m-logo { font-size: 22px; font-weight: 800; color: var(--mgold); text-decoration: none; letter-spacing: -1px; }
  .m-logo span { color: var(--mt); }
  .m-title { font-size: 20px; font-weight: 600; margin-left: 8px; }
  .m-top-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .m-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
  .m-theme-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--mc); color: var(--mt2); display: flex; align-items: center; justify-content: center; cursor: pointer; }

  .m-body { display: flex; flex: 1; overflow: hidden; }

  .m-convos { width: 340px; border-right: 1px solid var(--mbd); display: flex; flex-direction: column; background: var(--mcard); flex-shrink: 0; }
  .m-convos-header { display: flex; align-items: center; gap: 8px; padding: 12px; border-bottom: 1px solid var(--mbd); }
  .m-convos-search { flex: 1; padding: 14px 16px; border-radius: 20px; border: none; background: var(--mc); color: var(--mt); font-size: 15px; outline: none; font-family: inherit; }
  .m-convos-search::placeholder { color: var(--mt3); }
  .m-new-btn { width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--mgold); color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .m-new-conv { display: flex; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--mbd); }
  .m-new-conv input { flex: 1; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--mbd); background: var(--mc); color: var(--mt); font-size: 15px; outline: none; font-family: inherit; }
  .m-new-conv button { padding: 14px 16px; border-radius: 16px; border: none; background: var(--mgold); color: #000; font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit; }

  .m-convos-list { flex: 1; overflow-y: auto; min-height: 0; }
  .m-empty-conv { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; color: var(--mt3); font-size: 16px; gap: 10px; min-height: calc(100vh - 220px); }
  .m-empty-conv svg { opacity: 0.2; margin-bottom: 4px; }
  .m-empty-conv p { margin: 0; }
  .m-empty-sub { font-size: 14px; color: var(--mt3); opacity: 0.7; }

  .m-conv { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-bottom: 1px solid rgba(255,255,255,0.02); background: transparent; color: var(--mt); cursor: pointer; width: 100%; text-align: left; font-family: inherit; position: relative; }
  .m-conv:hover { background: var(--mhover); }
  .m-conv.active { background: rgba(245,166,35,0.06); }
  .m-conv-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--mgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; flex-shrink: 0; }
  .m-conv-body { flex: 1; min-width: 0; }
  .m-conv-top { display: flex; justify-content: space-between; align-items: center; }
  .m-conv-name { font-size: 16px; font-weight: 600; }
  .m-conv-time { font-size: 13px; color: var(--mt3); }
  .m-conv-preview { font-size: 14px; color: var(--mt2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .m-conv-action { background: none; border: none; color: var(--mt3); cursor: pointer; padding: 4px; border-radius: 50%; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
  .m-conv:hover .m-conv-action { opacity: 1; }
  .m-conv-action:hover { color: var(--mgold); background: var(--mhover); }
  .m-conv-badge { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; background: var(--mgold); color: #000; padding: 2px 7px; border-radius: 99px; font-weight: 800; }

  .m-chat { flex: 1; display: flex; flex-direction: column; background: var(--mb); min-height: 0; }
  .m-chat-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; }
  .m-chat-empty h2 { font-size: 22px; font-weight: 700; }
  .m-chat-empty p { color: var(--mt3); font-size: 16px; }

  .m-chat-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--mbd); background: var(--mcard); }
  .m-chat-user { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--mt); }
  .m-chat-user:hover .m-chat-name { text-decoration: underline; }
  .m-chat-name { font-size: 16px; font-weight: 700; }
  .m-chat-real { font-size: 13px; color: var(--mt2); }
  .m-e2e-lock { font-size: 12px; margin-left: 4px; }
  .m-e2e-badge { display: inline-block; font-size: 10px; color: var(--mgold); margin-left: 6px; font-weight: 600; }

  .m-messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
  .m-msg-empty { text-align: center; color: var(--mt3); font-size: 15px; padding: 40px; }
  .m-msg { display: flex; }
  .m-msg.mine { justify-content: flex-end; }
  .m-msg-bubble { max-width: 65%; padding: 12px 16px; border-radius: 18px; background: var(--mcard); border: 1px solid var(--mbd); }
  .m-msg.mine .m-msg-bubble { background: var(--mmine); border-color: var(--mmine-bd); border-bottom-right-radius: 4px; }
  .m-msg:not(.mine) .m-msg-bubble { border-bottom-left-radius: 4px; }
  .m-msg-text { font-size: 16px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
  .m-msg-time { font-size: 13px; color: var(--mt3); display: block; margin-top: 4px; }
  .m-msg.mine .m-msg-time { text-align: right; }
  .m-tick { margin-left: 4px; color: var(--mt3); font-size: 13px; }
  .m-tick-read { color: #3b82f6; }
  .m-typing { padding: 4px 20px 6px; font-size: 14px; color: var(--mt3); font-style: italic; min-height: 24px; }
  .m-typing-dots::after { content: '●●●'; letter-spacing: -2px; animation: typeDots 1.2s infinite; margin-right: 6px; font-style: normal; font-size: 8px; }
  @keyframes typeDots { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }

  .m-input-bar { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-top: 1px solid var(--mbd); background: var(--mcard); flex-shrink: 0; }
  .m-emoji-wrap { position: relative; }
  .m-emoji-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
  .m-emoji-btn:hover { background: var(--mhover); }
  .m-emoji-picker { position: absolute; bottom: 44px; left: 0; background: var(--mcard); border: 1px solid var(--mbd); border-radius: 12px; padding: 8px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; width: 280px; max-height: 200px; overflow-y: auto; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .m-emoji-item { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 6px; text-align: center; }
  .m-emoji-item:hover { background: var(--mhover); }
  .m-input { flex: 1; padding: 14px 18px; border-radius: 24px; border: 1px solid var(--mbd); background: var(--mc); color: var(--mt); font-size: 16px; outline: none; font-family: inherit; }
  .m-input:focus { border-color: var(--mgold); }
  .m-input::placeholder { color: var(--mt3); }
  .m-send { width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--mgold); color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .m-send:disabled { opacity: 0.3; cursor: not-allowed; }
  .m-send:hover:not(:disabled) { filter: brightness(1.1); }

  .m-chat-back { display: none; background: none; border: none; color: var(--mt2); cursor: pointer; padding: 4px; border-radius: 6px; }
  .m-chat-back:hover { color: var(--mt); background: var(--mhover); }

  @media (max-width: 640px) {
    .m-convos { width: 100%; }
    .m-chat { display: none; }
    .m-body.has-active .m-convos { display: none; }
    .m-body.has-active .m-chat { display: flex; }
    .m-chat-back { display: flex; }
    .m-emoji-wrap { display: none; }
  }
  .m-friend-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: none; border: 1px solid var(--mbd); border-radius: 8px; color: var(--mt); cursor: pointer; width: 100%; margin-top: 6px; font-family: inherit; font-size: 15px; }
  .m-friend-btn:hover { background: rgba(245,166,35,0.1); border-color: rgba(245,166,35,0.3); }
  .m-friend-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #e8941a); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #000; flex-shrink: 0; }
  :global(input, textarea, select) { font-size: 16px !important; -webkit-text-size-adjust: 100%; }

  /* Attachment button */
  .m-file-input { display: none; }
  .m-attach-btn { background: none; border: none; color: var(--mt2); cursor: pointer; padding: 4px 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .m-attach-btn:hover { color: var(--mgold); background: var(--mhover); }
  .m-attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Attachment preview in compose */
  .m-attach-preview { padding: 8px 16px 0; background: var(--mcard); }
  .m-attach-card { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--mc); border: 1px solid var(--mbd); border-radius: 12px; max-width: 320px; }
  .m-attach-thumb { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
  .m-attach-icon { width: 40px; height: 40px; border-radius: 8px; background: var(--mmine); color: var(--mgold); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .m-attach-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .m-attach-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-attach-size { font-size: 12px; color: var(--mt3); }
  .m-attach-remove { background: none; border: none; color: var(--mt3); cursor: pointer; padding: 4px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .m-attach-remove:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

  /* Upload spinner */
  .m-attach-uploading { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--mc); border: 1px solid var(--mbd); border-radius: 12px; max-width: 200px; font-size: 13px; color: var(--mt2); }
  .m-attach-spinner { width: 18px; height: 18px; border: 2px solid var(--mbd); border-top-color: var(--mgold); border-radius: 50%; animation: attachSpin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes attachSpin { to { transform: rotate(360deg); } }

  /* Message attachment rendering */
  .m-msg-attachment { margin-bottom: 6px; }
  .m-msg-img { max-width: 200px; border-radius: 10px; display: block; cursor: pointer; }
  .m-msg-img:hover { opacity: 0.9; }
  .m-msg-video { max-width: 250px; border-radius: 10px; display: block; }
  .m-msg-audio-wrap { display: flex; align-items: center; gap: 8px; color: var(--mt2); }
  .m-msg-audio { max-width: 220px; height: 32px; }
  .m-msg-doc { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--mc); border: 1px solid var(--mbd); border-radius: 10px; text-decoration: none; color: var(--mt); max-width: 250px; }
  .m-msg-doc:hover { border-color: var(--mgold); }
  .m-msg-doc svg:first-child { color: var(--mgold); flex-shrink: 0; }
  .m-msg-doc svg:last-child { color: var(--mt3); flex-shrink: 0; }
  .m-msg-doc-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .m-msg-doc-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-msg-doc-size { font-size: 11px; color: var(--mt3); }

  /* Tabs */
  .m-tabs { display: flex; border-bottom: 1px solid var(--mbd); flex-shrink: 0; }
  .m-tab { flex: 1; padding: 10px 0; background: none; border: none; color: var(--mt2); font-size: 14px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .m-tab.active { color: var(--mgold); border-bottom-color: var(--mgold); }
  .m-tab:hover { color: var(--mt); }
  .m-tab-badge { background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; }

  /* Message Requests */
  .m-conv-request { border-left: 3px solid var(--mgold); }
  .m-req-actions { display: flex; gap: 8px; margin-top: 6px; }
  .m-req-accept { padding: 4px 14px; border-radius: 6px; border: none; background: var(--mgold); color: #000; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .m-req-accept:hover { opacity: 0.9; }
  .m-req-decline { padding: 4px 14px; border-radius: 6px; border: 1px solid var(--mbd); background: none; color: var(--mt2); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .m-req-decline:hover { border-color: #ef4444; color: #ef4444; }

  </style>