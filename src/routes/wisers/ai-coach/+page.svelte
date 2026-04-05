<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { sendAiCoach } from '$lib/api/client';
  import { goto } from '$app/navigation';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }

  let theme = $state<'dark' | 'light'>('dark');
  let messages = $state<ChatMessage[]>([]);
  let inputValue = $state('');
  let loading = $state(false);
  let endpointAvailable = $state(true);
  let chatContainer: HTMLDivElement | undefined = $state(undefined);
  let inputEl: HTMLTextAreaElement | undefined = $state(undefined);

  const STORAGE_KEY = 'wisers-ai-coach-history';

  const suggestedPrompts = [
    'How should I start my side hustle?',
    'Review my wealth-building progress',
    "What's the fastest path to 10K/month?",
    'Help me set financial goals',
    'Analyze my community engagement',
    'Create a 90-day wealth plan'
  ];

  const promptIcons = [
    '\u{1F680}',
    '\u{1F4CA}',
    '\u{1F4B0}',
    '\u{1F3AF}',
    '\u{1F91D}',
    '\u{1F4C5}'
  ];

  onMount(() => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') {
      theme = 'light';
    } else if (!saved && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-wisers-theme', theme);
      document.body.style.background = theme === 'light' ? '#ffffff' : '#0a0a0f';
    }

    loadHistory();
  });

  function getStorageKey(): string {
    const userId = $auth.user?.id || 'anon';
    return `${STORAGE_KEY}-${userId}`;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) {
        messages = JSON.parse(raw);
      }
    } catch {
      messages = [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(messages));
    } catch {}
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });
  }

  $effect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  });
  async function sendToCoach(message: string, history: { role: string; content: string }[]) {
    return sendAiCoach(message, history);
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    messages = [...messages, userMsg];
    inputValue = '';
    loading = true;

    if (inputEl) {
      inputEl.style.height = 'auto';
    }

    saveHistory();
    scrollToBottom();

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await sendToCoach(text, history);

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || 'I received your message. Let me help you with your wealth-building journey.',
        timestamp: Date.now()
      };

      messages = [...messages, aiMsg];
      endpointAvailable = true;
    } catch {
      endpointAvailable = false;
      const fallbackMsg: ChatMessage = {
        role: 'assistant',
        content: '**AI Wealth Coach is coming soon!**\n\nThis feature is currently being developed. Soon you\'ll be able to:\n\n- Get personalized wealth-building advice\n- Review your financial progress\n- Create actionable plans for your goals\n- Analyze your community engagement\n\nStay tuned for updates!',
        timestamp: Date.now()
      };
      messages = [...messages, fallbackMsg];
    }

    loading = false;
    saveHistory();
    scrollToBottom();
  }

  function handlePromptClick(prompt: string) {
    inputValue = prompt;
    handleSend();
  }

  function clearChat() {
    messages = [];
    saveHistory();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    if (inputEl) {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    }
  }

  function renderMarkdown(text: string): string {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Clean up nested brs inside lists
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/<\/ul><br>/g, '</ul>');
    html = html.replace(/<br><ul>/g, '<ul>');

    return html;
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="coach-page" data-wisers-theme={theme}>
  <!-- Header -->
  <header class="coach-header">
    <button class="back-btn" aria-label="Back to feed" onclick={() => goto('/wisers')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="header-title">
      <svg class="sparkle-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
      </svg>
      <h1>AI Wealth Coach</h1>
    </div>
    {#if messages.length > 0}
      <button class="clear-btn" onclick={clearChat}>Clear</button>
    {:else}
      <div class="header-spacer"></div>
    {/if}
  </header>

  <!-- Chat Area -->
  <div class="chat-area" bind:this={chatContainer}>
    {#if messages.length === 0}
      <!-- Empty state with prompts -->
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
          </svg>
        </div>
        <h2>Your AI Wealth Coach</h2>
        <p>Ask me anything about building wealth, side hustles, financial goals, and your journey on Wisers.</p>

        {#if !endpointAvailable}
          <div class="coming-soon-badge">Coming Soon - Preview Mode</div>
        {/if}

        <div class="prompts-grid">
          {#each suggestedPrompts as prompt, i}
            <button class="prompt-pill" onclick={() => handlePromptClick(prompt)}>
              <span class="prompt-icon">{promptIcons[i]}</span>
              <span class="prompt-text">{prompt}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Messages -->
      <div class="messages-list">
        {#each messages as msg}
          <div class="message-row {msg.role}">
            {#if msg.role === 'assistant'}
              <div class="avatar ai-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
                </svg>
              </div>
            {/if}
            <div class="message-bubble {msg.role}">
              {#if msg.role === 'assistant'}
                {@html renderMarkdown(msg.content)}
              {:else}
                {msg.content}
              {/if}
              <span class="msg-time">{formatTime(msg.timestamp)}</span>
            </div>
            {#if msg.role === 'user'}
              <div class="avatar user-avatar">
                {#if $auth.user?.name}
                  {$auth.user.name.charAt(0).toUpperCase()}
                {:else}
                  U
                {/if}
              </div>
            {/if}
          </div>
        {/each}

        {#if loading}
          <div class="message-row assistant">
            <div class="avatar ai-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
              </svg>
            </div>
            <div class="message-bubble assistant typing-bubble">
              <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Input Bar -->
  <div class="input-bar">
    <div class="input-wrap">
      <textarea
        bind:this={inputEl}
        bind:value={inputValue}
        placeholder="Ask your wealth coach..."
        rows="1"
        onkeydown={handleKeydown}
        oninput={handleInput}
        disabled={loading}
      ></textarea>
      <button
        class="send-btn"
        aria-label="Send message"
        onclick={handleSend}
        disabled={!inputValue.trim() || loading}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  :root {
    --ac-bg: #0a0a0f;
    --ac-card: #111117;
    --ac-t: #e4e6ea;
    --ac-t2: #8a8a9a;
    --ac-gold: #f5a623;
    --ac-bd: #1e1e2a;
    --ac-user-bg: #f5a623;
    --ac-user-t: #000000;
    --ac-ai-bg: #18181f;
  }

  [data-wisers-theme="light"] {
    --ac-bg: #ffffff;
    --ac-card: #ffffff;
    --ac-t: #1c1e21;
    --ac-t2: #65676b;
    --ac-gold: #d4a017;
    --ac-bd: #dddfe2;
    --ac-user-bg: #d4a017;
    --ac-user-t: #000000;
    --ac-ai-bg: #f0f2f5;
  }

  .coach-page {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 800px;
    margin: 0 auto;
    background: var(--ac-bg);
    position: relative;
  }

  /* Header */
  .coach-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ac-bd);
    background: var(--ac-card);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--ac-t);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }

  .back-btn:hover {
    background: var(--ac-bd);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--ac-t);
    margin: 0;
    font-family: 'DM Sans', sans-serif;
  }

  .sparkle-icon {
    color: var(--ac-gold);
  }

  .clear-btn {
    background: none;
    border: 1px solid var(--ac-bd);
    color: var(--ac-t2);
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 15px;
    font-family: 'DM Sans', sans-serif;
    -webkit-tap-highlight-color: transparent;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    border-color: var(--ac-gold);
    color: var(--ac-gold);
  }

  .header-spacer {
    width: 60px;
  }

  /* Chat Area */
  .chat-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    padding-bottom: 100px;
    -webkit-overflow-scrolling: touch;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 16px;
    min-height: 60vh;
  }

  .empty-icon {
    color: var(--ac-gold);
    margin-bottom: 16px;
  }

  .empty-state h2 {
    font-size: 26px;
    font-weight: 700;
    color: var(--ac-t);
    margin: 0 0 8px;
    font-family: 'DM Sans', sans-serif;
  }

  .empty-state p {
    font-size: 16px;
    color: var(--ac-t2);
    margin: 0 0 24px;
    max-width: 400px;
    line-height: 1.5;
  }

  .coming-soon-badge {
    background: var(--ac-gold);
    color: #000;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 24px;
    font-family: 'DM Sans', sans-serif;
  }

  .prompts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
    max-width: 500px;
  }

  .prompt-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--ac-gold);
    border-radius: 12px;
    background: transparent;
    color: var(--ac-t);
    font-size: 15px;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    -webkit-tap-highlight-color: transparent;
  }

  .prompt-pill:hover {
    background: var(--ac-gold);
    color: #000;
  }

  .prompt-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .prompt-text {
    line-height: 1.3;
  }

  /* Messages */
  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    max-width: 85%;
  }

  .message-row.user {
    align-self: flex-end;
    margin-left: auto;
    flex-direction: row;
  }

  .message-row.assistant {
    align-self: flex-start;
    flex-direction: row;
  }

  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 700;
    font-family: 'DM Sans', sans-serif;
  }

  .ai-avatar {
    background: var(--ac-gold);
    color: #000;
  }

  .user-avatar {
    background: var(--ac-bd);
    color: var(--ac-t);
  }

  .message-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 16px;
    line-height: 1.6;
    font-family: 'DM Sans', sans-serif;
    position: relative;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .message-bubble.user {
    background: var(--ac-user-bg);
    color: var(--ac-user-t);
    border-bottom-right-radius: 4px;
  }

  .message-bubble.assistant {
    background: var(--ac-ai-bg);
    color: var(--ac-t);
    border-bottom-left-radius: 4px;
  }

  .message-bubble :global(strong) {
    font-weight: 700;
  }

  .message-bubble :global(em) {
    font-style: italic;
  }

  .message-bubble :global(code) {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 15px;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .message-bubble :global(ul) {
    margin: 8px 0;
    padding-left: 18px;
  }

  .message-bubble :global(li) {
    margin-bottom: 4px;
  }

  .msg-time {
    display: block;
    font-size: 10px;
    opacity: 0.5;
    margin-top: 4px;
    text-align: right;
  }

  /* Typing Indicator */
  .typing-bubble {
    padding: 14px 18px;
  }

  .typing-dots {
    display: flex;
    gap: 5px;
    align-items: center;
  }

  .typing-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ac-t2);
    animation: typingBounce 1.4s ease-in-out infinite;
  }

  .typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typingBounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-6px);
      opacity: 1;
    }
  }

  /* Input Bar */
  .input-bar {
    position: sticky;
    bottom: 0;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    background: var(--ac-card);
    border-top: 1px solid var(--ac-bd);
    z-index: 10;
  }

  .input-wrap {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: var(--ac-ai-bg);
    border: 1px solid var(--ac-bd);
    border-radius: 24px;
    padding: 6px 6px 6px 16px;
  }

  .input-wrap textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ac-t);
    font-size: 17px;
    font-family: 'DM Sans', sans-serif;
    resize: none;
    line-height: 1.5;
    padding: 6px 0;
    max-height: 120px;
    min-height: 24px;
  }

  .input-wrap textarea::placeholder {
    color: var(--ac-t2);
  }

  .send-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: var(--ac-gold);
    color: #000;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.2s, transform 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    transform: scale(1.05);
  }

  .send-btn:not(:disabled):active {
    transform: scale(0.95);
  }

  /* Mobile */
  @media (max-width: 768px) {
    .coach-page {
      max-width: 100%;
    }

    .chat-area {
      padding-bottom: 80px;
    }

    .prompts-grid {
      grid-template-columns: 1fr;
    }

    .message-row {
      max-width: 90%;
    }

    .empty-state {
      padding: 24px 16px;
      min-height: 50vh;
    }

    .empty-state h2 {
      font-size: 20px;
    }

    .input-bar {
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    }
  }

  @media (max-width: 380px) {
    .prompt-pill {
      padding: 10px 12px;
      font-size: 12px;
    }

    .prompt-icon {
      font-size: 16px;
    }

    .header-title h1 {
      font-size: 16px;
    }

    .message-bubble {
      font-size: 13px;
    }
  }

  /* Prevent iOS zoom on input focus */
  .input-wrap textarea {
    font-size: 17px;
  }

  /* Scrollbar styling */
  .chat-area::-webkit-scrollbar {
    width: 4px;
  }

  .chat-area::-webkit-scrollbar-track {
    background: transparent;
  }

  .chat-area::-webkit-scrollbar-thumb {
    background: var(--ac-bd);
    border-radius: 4px;
  }
</style>
