<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  type Msg = { id?: string; sender_type: string; sender_name: string; content: string; created_at?: string };

  let messages = $state<Msg[]>([]);
  let input = $state('');
  let sessionId = $state<string | null>(null);
  let sessionStatus = $state<string>('idle');
  let handlerName = $state<string | null>(null);
  let loading = $state(false);
  let sending = $state(false);
  let category = $state('');
  let showRating = $state(false);
  let rating = $state(0);
  let rated = $state(false);
  let ws: WebSocket | null = null;

  // ── Support Ticket (non-live) ─���───────────────────
  let supportTab = $state<'chat' | 'ticket'>('chat');
  let ticket = $state<any>(null);
  let ticketLoading = $state(false);
  let ticketReply = $state('');
  let ticketSending = $state(false);

  async function loadTicket() {
    ticketLoading = true;
    try {
      ticket = await api.getSupportTicket();
    } catch { ticket = null; }
    ticketLoading = false;
  }

  async function sendTicketReply() {
    if (!ticketReply.trim() || ticketSending) return;
    ticketSending = true;
    try {
      await api.sendSupportMessage(ticketReply.trim());
      ticketReply = '';
      await loadTicket();
    } catch {}
    ticketSending = false;
  }

  // ── Resume support session ────────────────────────
  async function resumeSession(sid: string) {
    sessionId = sid;
    try {
      const res = await api.getSupportSession(sid);
      sessionStatus = res.status || 'active';
      handlerName = res.handler_name || null;
      messages = res.messages || [];
      if (res.status !== 'closed') connectWS(sid);
    } catch {
      messages = [{ sender_type: 'system', sender_name: 'System', content: 'Could not load session.' }];
    }
    scrollBottom();
  }

  const categories = [
    { value: '', label: 'General' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'billing', label: 'Billing' },
    { value: 'account_access', label: 'Account Access' },
    { value: 'other', label: 'Other' },
  ];

  onMount(() => {
    messages = [{
      sender_type: 'ai', sender_name: 'BSCAN Support',
      content: "Hi! I'm BSCAN's support assistant. I can help with scanning, SEO tools, pricing, billing, and account questions.\n\nType your question below and I'll do my best to help. If I can't resolve it, I'll connect you with our team."
    }];
    // Resume session if returning via URL param
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) { resumeSession(sid); window.history.replaceState({}, '', '/support'); }
  });

  onDestroy(() => {
    if (ws) { ws.close(); ws = null; }
  });

  async function startSession() {
    if (!input.trim()) return;
    if (!$auth.token) { window.location.href = '/account'; return; }

    const text = input.trim();
    input = '';
    loading = true;

    messages = [...messages, { sender_type: 'user', sender_name: 'You', content: text }];

    try {
      const res = await api.startSupportSession('bscan', text, category || undefined);
      sessionId = res.session_id;
      sessionStatus = res.status;

      // Add AI response + any system messages from the response
      for (const msg of res.messages || []) {
        if (msg.sender_type !== 'user') {
          messages = [...messages, msg];
        }
      }

      // Start polling if transferred to queue
      if (res.status !== 'ai') connectWS(res.session_id);
    } catch (e: any) {
      messages = [...messages, { sender_type: 'ai', sender_name: 'System', content: e.message || 'Something went wrong. Please try again.' }];
    }
    loading = false;
    scrollBottom();
  }

  async function send() {
    if (!input.trim() || !sessionId) return;
    if (!$auth.token) { window.location.href = '/account'; return; }

    const text = input.trim();
    input = '';
    sending = true;

    messages = [...messages, { sender_type: 'user', sender_name: 'You', content: text }];
    scrollBottom();

    try {
      const res = await api.sendLiveSupportMessage(sessionId, text);

      if (res.ai_response) {
        messages = [...messages, res.ai_response];
      }

      if (res.status && res.status !== sessionStatus) {
        sessionStatus = res.status;
        if (res.status !== 'ai' && sessionId) connectWS(sessionId);
      }
    } catch (e: any) {
      messages = [...messages, { sender_type: 'ai', sender_name: 'System', content: e.message || 'Failed to send message.' }];
    }
    sending = false;
    scrollBottom();
  }

  function connectWS(sid: string) {
    if (ws) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = (import.meta.env.VITE_API_URL || '').replace(/^https?:/, proto) || `${proto}//${location.host}`;
    const url = `${base}/api/support/ws/${sid}?token=${$auth.token}`;
    ws = new WebSocket(url);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.action === 'new_message' && data.message) {
          messages = [...messages, data.message];
          scrollBottom();
        } else if (data.action === 'session_update') {
          if (data.handler_name) handlerName = data.handler_name;
          if (data.status) {
            sessionStatus = data.status;
            if (data.status === 'closed') {
              showRating = true;
              if (ws) { ws.close(); ws = null; }
            }
          }
        } else if (data.action === 'pong') {
          // heartbeat ack
        }
      } catch {}
    };

    ws.onclose = () => {
      ws = null;
      // Reconnect if session still active
      if (sessionId && sessionStatus !== 'closed') {
        setTimeout(() => connectWS(sid), 3000);
      }
    };

    ws.onerror = () => { ws?.close(); };

    // Heartbeat every 30s
    const hb = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      } else {
        clearInterval(hb);
      }
    }, 30000);
  }

  async function doClose() {
    if (!sessionId) return;
    try {
      await api.closeSupportSession(sessionId);
      sessionStatus = 'closed';
      showRating = true;
      if (ws) { ws.close(); ws = null; }
      messages = [...messages, { sender_type: 'system', sender_name: 'System', content: 'You ended the conversation.' }];
    } catch {}
  }

  async function doRate(r: number) {
    if (!sessionId || rated) return;
    rating = r;
    try {
      await api.rateSupportSession(sessionId, r);
      rated = true;
    } catch {}
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sessionId ? send() : startSession();
    }
  }

  function scrollBottom() {
    setTimeout(() => {
      const el = document.getElementById('support-chat');
      if (el) el.scrollTop = el.scrollHeight;
    }, 80);
  }

  function timeAgo(d?: string) {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
</script>

<svelte:head><title>Support — BSCAN</title></svelte:head>

<div class="sp">
  <!-- Tab toggle -->
  <div class="sp-tabs">
    <button class="sp-tab" class:sp-tab-active={supportTab === 'chat'} onclick={() => supportTab = 'chat'}>Live Chat</button>
    <button class="sp-tab" class:sp-tab-active={supportTab === 'ticket'} onclick={() => { supportTab = 'ticket'; if (!ticket) loadTicket(); }}>My Ticket</button>
  </div>

  {#if supportTab === 'ticket'}
    <div class="sp-ticket-card">
      {#if ticketLoading}
        <div style="padding: 48px; text-align: center;"><span class="spinner"></span></div>
      {:else if !ticket}
        <div style="padding: 48px; text-align: center;">
          <p style="font-size: 14px; color: var(--clr-text-muted);">No open ticket found. Use Live Chat to contact support.</p>
        </div>
      {:else}
        <div class="sp-ticket-header">
          <div>
            <div class="sp-ticket-title">Support Ticket</div>
            <span class="sp-ticket-badge" class:sp-badge-open={ticket.status === 'open'} class:sp-badge-progress={ticket.status === 'in_progress'} class:sp-badge-resolved={ticket.status === 'resolved'}>{ticket.status?.replace('_', ' ')}</span>
          </div>
          {#if ticket.created_at}<span class="text-muted" style="font-size: 11px;">Opened {new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>{/if}
        </div>
        <div class="sp-ticket-thread">
          {#each (ticket.messages || []) as msg}
            <div class="sp-msg" class:sp-mine={msg.sender_type === 'user'}>
              <div class="sp-bubble"
                class:sp-bubble-user={msg.sender_type === 'user'}
                class:sp-bubble-staff={msg.sender_type === 'staff' || msg.sender_type === 'admin'}
              >
                {#if msg.sender_name && msg.sender_type !== 'user'}<div class="sp-sender" class:sp-sender-staff={msg.sender_type === 'staff'}>{msg.sender_name}</div>{/if}
                <div class="sp-text">{msg.content}</div>
                {#if msg.created_at}<div class="sp-time">{timeAgo(msg.created_at)}</div>{/if}
              </div>
            </div>
          {/each}
        </div>
        {#if ticket.status !== 'resolved'}
          <div class="sp-input-bar">
            <textarea class="sp-input" bind:value={ticketReply} placeholder="Reply to your ticket..." rows={1} onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTicketReply(); } }}></textarea>
            <button class="sp-send" aria-label="Send reply" onclick={sendTicketReply} disabled={!ticketReply.trim() || ticketSending}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {:else}
  <div class="sp-card">
    <!-- Header -->
    <div class="sp-header">
      <div class="sp-header-left">
        <div class="sp-avatar">B</div>
        <div>
          <div class="sp-title">BSCAN Support</div>
          <div class="sp-status">
            {#if sessionStatus === 'ai' || sessionStatus === 'idle'}
              AI Assistant
            {:else if sessionStatus === 'queued' || sessionStatus === 'transferred'}
              Waiting for a team member...
            {:else if sessionStatus === 'active'}
              {handlerName || 'Support agent'} connected
            {:else if sessionStatus === 'closed'}
              Session ended
            {/if}
          </div>
        </div>
      </div>
      <div class="sp-header-actions">
        {#if sessionId && sessionStatus !== 'closed'}
          <button class="sp-close-btn" onclick={doClose}>End chat</button>
        {/if}
      </div>
    </div>

    <!-- Messages -->
    <div class="sp-messages" id="support-chat">
      {#each messages as msg}
        <div class="sp-msg" class:sp-mine={msg.sender_type === 'user'} class:sp-system={msg.sender_type === 'system'}>
          <div class="sp-bubble"
            class:sp-bubble-user={msg.sender_type === 'user'}
            class:sp-bubble-ai={msg.sender_type === 'ai'}
            class:sp-bubble-staff={msg.sender_type === 'staff'}
            class:sp-bubble-system={msg.sender_type === 'system'}
          >
            {#if msg.sender_type !== 'user' && msg.sender_type !== 'system'}
              <div class="sp-sender" class:sp-sender-staff={msg.sender_type === 'staff'}>{msg.sender_name}</div>
            {/if}
            <div class="sp-text">{msg.content}</div>
            {#if msg.created_at}<div class="sp-time">{timeAgo(msg.created_at)}</div>{/if}
          </div>
        </div>
      {/each}

      {#if loading || sending}
        <div class="sp-msg">
          <div class="sp-bubble sp-bubble-ai">
            <div class="sp-typing"><span></span><span></span><span></span></div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Rating -->
    {#if showRating}
      <div class="sp-rating">
        {#if rated}
          <div class="sp-rating-thanks">Thanks for your feedback!</div>
        {:else}
          <div class="sp-rating-prompt">How was your experience?</div>
          <div class="sp-stars">
            {#each [1, 2, 3, 4, 5] as star}
              <button class="sp-star" class:sp-star-active={rating >= star} onclick={() => doRate(star)}>
                {rating >= star ? '★' : '☆'}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Category picker (before session starts) -->
    {#if !sessionId}
      <div class="sp-category">
        {#each categories as cat}
          <button
            class="sp-cat-btn"
            class:sp-cat-active={category === cat.value}
            onclick={() => category = cat.value}
          >{cat.label}</button>
        {/each}
      </div>
    {/if}

    <!-- Input -->
    {#if sessionStatus !== 'closed'}
      <div class="sp-input-bar">
        <textarea
          class="sp-input"
          bind:value={input}
          placeholder={sessionId ? 'Type a message...' : 'Describe your issue...'}
          rows={1}
          onkeydown={handleKey}
        ></textarea>
        <button
          class="sp-send"
          aria-label="Send message"
          onclick={() => sessionId ? send() : startSession()}
          disabled={!input.trim() || loading || sending}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    {/if}
  </div>
  {/if}
</div>

<style>
  .sp { max-width: 600px; margin: 0 auto; padding: 24px 16px; min-height: calc(100vh - 80px); display: flex; align-items: center; }
  .sp-card { width: 100%; border-radius: 16px; border: 1px solid var(--clr-border, #2a2a3e); background: var(--clr-bg-card, #1a1a2e); overflow: hidden; display: flex; flex-direction: column; height: 620px; }
  .sp-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--clr-border); }
  .sp-header-left { display: flex; align-items: center; gap: 10px; }
  .sp-header-actions { display: flex; gap: 6px; }
  .sp-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--clr-gold, #f5a623); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
  .sp-title { font-size: 14px; font-weight: 700; }
  .sp-status { font-size: 11px; color: var(--clr-success, #22c55e); }
  .sp-close-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.3); background: none; color: #ef4444; font-size: 11px; cursor: pointer; font-family: inherit; }
  .sp-close-btn:hover { background: rgba(239,68,68,0.08); }

  .sp-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }

  .sp-msg { display: flex; }
  .sp-mine { justify-content: flex-end; }
  .sp-system { justify-content: center; }

  .sp-bubble { max-width: 80%; padding: 10px 14px; border-radius: 14px; background: var(--clr-bg-deep, #0d0d1a); border: 1px solid var(--clr-border); }
  .sp-bubble-user { background: rgba(245,166,35,0.1); border-color: rgba(245,166,35,0.2); border-bottom-right-radius: 4px; }
  .sp-bubble-ai { border-bottom-left-radius: 4px; }
  .sp-bubble-staff { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.2); border-bottom-left-radius: 4px; }
  .sp-bubble-system { background: transparent; border: none; max-width: 100%; text-align: center; padding: 6px 12px; }

  .sp-sender { font-size: 10px; font-weight: 700; color: var(--clr-gold, #f5a623); margin-bottom: 2px; }
  .sp-sender-staff { color: #3b82f6; }
  .sp-text { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
  .sp-bubble-system .sp-text { font-size: 11px; color: var(--clr-text-muted, #666); font-style: italic; }
  .sp-time { font-size: 9px; color: var(--clr-text-muted); margin-top: 4px; }

  .sp-typing { display: flex; gap: 4px; padding: 4px 0; }
  .sp-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--clr-text-muted); animation: blink 1s infinite; }
  .sp-typing span:nth-child(2) { animation-delay: 0.2s; }
  .sp-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

  .sp-category { display: flex; gap: 6px; padding: 8px 16px; border-top: 1px solid var(--clr-border); flex-wrap: wrap; }
  .sp-cat-btn { padding: 4px 12px; border-radius: 20px; border: 1px solid var(--clr-border); background: none; color: var(--clr-text-muted, #888); font-size: 11px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .sp-cat-btn:hover { border-color: var(--clr-gold); color: var(--clr-gold); }
  .sp-cat-active { border-color: var(--clr-gold); color: var(--clr-gold); background: rgba(245,166,35,0.08); }

  .sp-rating { padding: 12px 16px; border-top: 1px solid var(--clr-border); text-align: center; }
  .sp-rating-prompt { font-size: 12px; color: var(--clr-text-muted); margin-bottom: 8px; }
  .sp-rating-thanks { font-size: 12px; color: var(--clr-gold); font-weight: 600; }
  .sp-stars { display: flex; justify-content: center; gap: 8px; }
  .sp-star { font-size: 24px; background: none; border: none; cursor: pointer; color: var(--clr-text-muted); transition: color 0.15s; }
  .sp-star-active { color: var(--clr-gold, #f5a623); }
  .sp-star:hover { color: var(--clr-gold, #f5a623); }

  .sp-input-bar { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--clr-border); }
  .sp-input { flex: 1; padding: 10px 16px; border-radius: 20px; border: 1px solid var(--clr-border); background: var(--clr-bg-deep, #0d0d1a); color: var(--clr-text, #e0e0f0); font-size: 13px; outline: none; font-family: inherit; resize: none; min-height: 36px; }
  .sp-input:focus { border-color: var(--clr-gold); }
  .sp-send { width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--clr-gold, #f5a623); color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .sp-send:disabled { opacity: 0.3; }

  @media (max-width: 480px) {
    .sp { padding: 12px 8px; align-items: flex-start; }
    .sp-card { height: calc(100vh - 140px); border-radius: 12px; }
  }

  /* ── Tabs ───────────────────── */
  .sp-tabs { display: flex; gap: 4px; margin-bottom: 12px; padding: 4px; background: var(--clr-bg-deep, #0d0d1a); border-radius: 10px; width: 100%; max-width: 600px; }
  .sp-tab { flex: 1; padding: 8px; font-size: 12px; font-weight: 700; border: none; background: none; color: var(--clr-text-muted, #666); cursor: pointer; border-radius: 8px; transition: all 0.15s; font-family: inherit; }
  .sp-tab-active { background: var(--clr-bg-card, #1a1a2e); color: var(--clr-text, #e0e0f0); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }

  /* ── Ticket view ────────────── */
  .sp-ticket-card { width: 100%; max-width: 600px; border-radius: 16px; border: 1px solid var(--clr-border, #2a2a3e); background: var(--clr-bg-card, #1a1a2e); overflow: hidden; display: flex; flex-direction: column; min-height: 400px; }
  .sp-ticket-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--clr-border); }
  .sp-ticket-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .sp-ticket-badge { font-size: 10px; padding: 2px 10px; border-radius: 20px; font-weight: 700; font-family: var(--font-mono, monospace); text-transform: uppercase; }
  .sp-badge-open { background: rgba(59,130,246,0.12); color: #3b82f6; }
  .sp-badge-progress { background: rgba(245,166,35,0.12); color: #f5a623; }
  .sp-badge-resolved { background: rgba(34,197,94,0.12); color: #22c55e; }
  .sp-ticket-thread { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
</style>
