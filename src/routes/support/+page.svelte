<script lang="ts">
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  type Msg = { id?: number; sender_type: string; sender_name: string; content: string; created_at?: string; isAi?: boolean };

  let messages = $state<Msg[]>([]);
  let input = $state('');
  let escalated = $state(false);
  let ticketId = $state<number | null>(null);
  let loading = $state(false);

  const faqs: Record<string, string> = {
    'scanner|scan|audit|check': "BSCAN's Scanner audits any website instantly — paste a URL and get scores for SEO, performance, accessibility, and security with AI-powered fix suggestions.",
    'price|pricing|cost|plan|free|pro|agency': "BSCAN offers Free (5 scans/day), Pro ($19/mo — unlimited scans, monitoring, API), and Agency ($49/mo — team features, white-label reports, priority support).",
    'seo|keyword|backlink': "Our SEO Dashboard includes keyword research, backlink analysis, AI visibility checks, and Google Search Console integration.",
    'monitor|alert|track': "Website Monitoring tracks your sites 24/7 and sends email alerts when scores change. Available on Pro and Agency plans.",
    'compare|vs|versus': "The Compare tool lets you scan two websites side-by-side and see exactly where one outperforms the other.",
    'deep crawl|crawl|pages': "Deep Crawl scans multiple pages of a website at once, giving you a comprehensive site-wide audit.",
    'wisers|community|social|friend': "Wisers is our community platform where web professionals connect, share insights, and help each other improve their web presence.",
    'api|integrate|developer': "BSCAN offers a REST API on Pro and Agency plans. Check /api-docs for endpoints and authentication details.",
    'cancel|refund|billing': "You can cancel your subscription anytime from Account Settings. Refunds are handled on a case-by-case basis — contact support for help.",
    'bug|error|broken|not working': "Sorry to hear that! Can you describe what's happening? If I can't help, I'll connect you with our support team.",
    'account|login|password|register': "Manage your account at /account. You can update your name, email, password, and subscription there. For login issues, try resetting your password.",
    'team|member|invite': "Agency plans include team features — invite team members, share scans, and collaborate with team notes.",
    'report|pdf|export': "You can export scan results as professional PDF reports. White-label reports (your branding) are available on Agency plans.",
  };

  onMount(() => {
    messages = [{ sender_type: 'ai', sender_name: 'BSCAN Support', content: "Hi! I'm BSCAN's AI assistant. Ask me anything about our tools, pricing, or features. If I can't help, I'll connect you with our team.", isAi: true }];
  });

  function getAiResponse(q: string): string | null {
    const lower = q.toLowerCase();
    for (const [keys, answer] of Object.entries(faqs)) {
      if (keys.split('|').some(k => lower.includes(k))) return answer;
    }
    return null;
  }

  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    input = '';

    messages = [...messages, { sender_type: 'user', sender_name: 'You', content: text }];

    if (!escalated) {
      const aiAnswer = getAiResponse(text);
      if (aiAnswer) {
        setTimeout(() => {
          messages = [...messages, { sender_type: 'ai', sender_name: 'BSCAN Support', content: aiAnswer, isAi: true }];
          scrollBottom();
        }, 500);
      } else {
        setTimeout(() => {
          messages = [...messages, { sender_type: 'ai', sender_name: 'BSCAN Support', content: "I'm not sure about that. Would you like me to connect you with our support team? They'll get back to you shortly.", isAi: true }];
          scrollBottom();
        }, 500);
      }
    } else {
      if ($auth.token) {
        try {
          await api.sendSupportMessage(text);
        } catch {}
      }
    }
    scrollBottom();
  }

  async function escalate() {
    if (!$auth.token) {
      window.location.href = '/account';
      return;
    }
    escalated = true;
    loading = true;
    try {
      const res = await api.getSupportTicket();
      ticketId = res.ticket_id;
      if (res.messages && res.messages.length > 0) {
        const humanMsgs = res.messages.map((m: any) => ({
          sender_type: m.sender_type, sender_name: m.sender_name, content: m.content, created_at: m.created_at
        }));
        messages = [...messages, ...humanMsgs];
      }
    } catch {}
    messages = [...messages, {
      sender_type: 'ai', sender_name: 'BSCAN Support', content: "You're now connected to our support team. Send your message and we'll get back to you as soon as possible. You'll receive a notification when we reply.", isAi: true
    }];
    loading = false;
    scrollBottom();
  }

  async function refreshTicket() {
    if (!$auth.token || !escalated) return;
    try {
      const res = await api.getSupportTicket();
      const humanMsgs = (res.messages || []).map((m: any) => ({
        sender_type: m.sender_type, sender_name: m.sender_name, content: m.content, created_at: m.created_at
      }));
      const aiMsgs = messages.filter(m => m.isAi);
      messages = [...aiMsgs, ...humanMsgs];
    } catch {}
  }

  function scrollBottom() {
    setTimeout(() => { const el = document.getElementById('support-chat'); if (el) el.scrollTop = el.scrollHeight; }, 150);
  }

  function timeAgo(d?: string) {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }
</script>

<svelte:head><title>Support — BSCAN</title></svelte:head>

<div class="sp">
  <div class="sp-card">
    <div class="sp-header">
      <div class="sp-header-left">
        <div class="sp-avatar">B</div>
        <div>
          <div class="sp-title">BSCAN Support</div>
          <div class="sp-status">{escalated ? 'Connected to support team' : 'AI Assistant'}</div>
        </div>
      </div>
      {#if escalated}
        <button class="sp-refresh" onclick={refreshTicket}>Refresh</button>
      {/if}
    </div>

    <div class="sp-messages" id="support-chat">
      {#each messages as msg}
        <div class="sp-msg" class:sp-mine={msg.sender_type === 'user'} class:sp-admin={msg.sender_type === 'admin'}>
          <div class="sp-bubble" class:sp-bubble-ai={msg.isAi} class:sp-bubble-admin={msg.sender_type === 'admin'}>
            {#if msg.sender_type !== 'user'}<div class="sp-sender">{msg.sender_name}</div>{/if}
            <div class="sp-text">{msg.content}</div>
            {#if msg.created_at}<div class="sp-time">{timeAgo(msg.created_at)}</div>{/if}
          </div>
        </div>
      {/each}
    </div>

    {#if !escalated}
      <div class="sp-escalate">
        <button class="sp-escalate-btn" onclick={escalate}>Talk to a human</button>
      </div>
    {/if}

    <div class="sp-input-bar">
      <input type="text" class="sp-input" bind:value={input} placeholder={escalated ? "Message support team..." : "Ask me anything..."}
        onkeydown={(e) => e.key === 'Enter' && send()} />
      <button class="sp-send" onclick={send} disabled={!input.trim()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</div>

<style>
  .sp { max-width: 600px; margin: 0 auto; padding: 24px 16px; min-height: calc(100vh - 80px); display: flex; align-items: center; }
  .sp-card { width: 100%; border-radius: 16px; border: 1px solid var(--clr-border, #2a2a3e); background: var(--clr-bg-card, #1a1a2e); overflow: hidden; display: flex; flex-direction: column; height: 600px; }
  .sp-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--clr-border); }
  .sp-header-left { display: flex; align-items: center; gap: 10px; }
  .sp-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--clr-gold, #f5a623); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
  .sp-title { font-size: 14px; font-weight: 700; }
  .sp-status { font-size: 11px; color: var(--clr-text-muted, #666); }
  .sp-refresh { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--clr-border); background: none; color: var(--clr-text-muted); font-size: 11px; cursor: pointer; }
  .sp-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .sp-msg { display: flex; }
  .sp-mine { justify-content: flex-end; }
  .sp-bubble { max-width: 80%; padding: 10px 14px; border-radius: 14px; background: var(--clr-bg-deep, #0d0d1a); border: 1px solid var(--clr-border); }
  .sp-mine .sp-bubble { background: rgba(245,166,35,0.1); border-color: rgba(245,166,35,0.2); border-bottom-right-radius: 4px; }
  .sp-bubble-ai { border-bottom-left-radius: 4px; }
  .sp-bubble-admin { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.2); border-bottom-left-radius: 4px; }
  .sp-sender { font-size: 10px; font-weight: 700; color: var(--clr-gold, #f5a623); margin-bottom: 2px; }
  .sp-bubble-admin .sp-sender { color: #3b82f6; }
  .sp-text { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
  .sp-time { font-size: 9px; color: var(--clr-text-muted); margin-top: 4px; }
  .sp-escalate { padding: 8px 16px; border-top: 1px solid var(--clr-border); text-align: center; }
  .sp-escalate-btn { padding: 6px 16px; border-radius: 20px; border: 1px solid var(--clr-border); background: none; color: var(--clr-text-muted, #888); font-size: 12px; cursor: pointer; font-family: inherit; }
  .sp-escalate-btn:hover { border-color: var(--clr-gold); color: var(--clr-gold); }
  .sp-input-bar { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--clr-border); }
  .sp-input { flex: 1; padding: 10px 16px; border-radius: 20px; border: 1px solid var(--clr-border); background: var(--clr-bg-deep, #0d0d1a); color: var(--clr-text, #e0e0f0); font-size: 13px; outline: none; font-family: inherit; }
  .sp-input:focus { border-color: var(--clr-gold); }
  .sp-send { width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--clr-gold, #f5a623); color: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .sp-send:disabled { opacity: 0.3; }
</style>