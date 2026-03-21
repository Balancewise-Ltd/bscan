<script lang="ts">
	import { chat } from '$lib/stores/chat';
	import { sanitize } from '$lib/utils/security';

	let inputText = $state('');
	let messagesEl: HTMLDivElement | undefined = $state();

	const quickPrompts = [
		'What can BSCAN do?',
		'How do I improve my score?',
		'What SEO tools are free?',
		'How does site monitoring work?',
		'What does Agency plan include?',
		'How do I get AI fix suggestions?'
	];

	let showQuick = $state(true);

	function linkify(text: string): string {
		// Sanitize first, then convert URLs to clickable links
		const safe = sanitize(text);
		// Match URLs (http/https)
		return safe.replace(
			/(https?:\/\/[^\s<&]+)/g,
			'<a href="$1" target="_blank" rel="noopener" style="color: var(--clr-gold); text-decoration: underline;">$1</a>'
		).replace(/\n/g, '<br>');
	}

	function handleSend() {
		if (!inputText.trim()) return;
		chat.send(inputText);
		inputText = '';
		showQuick = false;
		scrollToBottom();
	}

	function handleQuick(text: string) {
		showQuick = false;
		chat.send(text);
		scrollToBottom();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSend();
	}

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
		});
	}

	$effect(() => {
		// scroll whenever messages change
		$chat.messages;
		scrollToBottom();
	});
</script>

<div class="chat-widget">
	<!-- Toggle Button -->
	<button class="chat-toggle" onclick={() => chat.toggle()}>
		{#if $chat.isOpen}
			<span class="toggle-icon">✕</span>
		{:else}
			<span class="toggle-icon">💬</span>
		{/if}
	</button>

	{#if !$chat.isOpen && $chat.hasUnread}
		<span class="unread-dot">1</span>
	{/if}

	<!-- Chat Window -->
	{#if $chat.isOpen}
		<div class="chat-window animate-scale-in">
			<!-- Header -->
			<div class="chat-header">
				<div class="chat-avatar">🤖</div>
				<div class="chat-header-text">
					<div class="chat-name">BSCAN Assistant</div>
					<div class="chat-status">
						<span class="status-dot"></span>
						Online — powered by AI
					</div>
				</div>
				<button class="chat-close" onclick={() => chat.close()}>✕</button>
			</div>

			<!-- Messages -->
			<div class="chat-messages" bind:this={messagesEl}>
				{#each $chat.messages as msg}
					<div class="msg" class:msg-user={msg.role === 'user'} class:msg-bot={msg.role === 'assistant'}>
						<div class="msg-bubble" class:bubble-user={msg.role === 'user'} class:bubble-bot={msg.role === 'assistant'}>
							{@html linkify(msg.content)}
						</div>
					</div>
				{/each}

				{#if $chat.isTyping}
					<div class="msg msg-bot">
						<div class="msg-bubble bubble-bot">
							<div class="typing-dots">
								<span class="dot"></span><span class="dot"></span><span class="dot"></span>
							</div>
						</div>
					</div>
				{/if}

				{#if showQuick}
					<div class="quick-prompts">
						{#each quickPrompts as prompt}
							<button class="quick-btn" onclick={() => handleQuick(prompt)}>{prompt}</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Input -->
			<div class="chat-input-area">
				<input
					class="chat-input"
					type="text"
					placeholder="Ask anything about BSCAN..."
					bind:value={inputText}
					onkeydown={handleKeydown}
				/>
				<button class="chat-send" onclick={handleSend} aria-label="Send message">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.chat-widget {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 300;
	}

	.chat-toggle {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--clr-gold), #c88600);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 20px rgba(240, 165, 0, 0.35);
		transition: transform var(--duration-fast) var(--ease-spring);
	}

	.chat-toggle:hover { transform: scale(1.08); }

	.toggle-icon { font-size: 22px; }

	.unread-dot {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--clr-danger);
		border: 2px solid var(--clr-bg-deep);
		font-size: 10px;
		font-weight: 800;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chat-window {
		position: absolute;
		bottom: 66px;
		right: 0;
		width: 380px;
		max-width: calc(100vw - 32px);
		background: var(--clr-bg-primary);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.chat-header {
		padding: 14px 16px;
		background: linear-gradient(135deg, var(--clr-bg-card), var(--clr-bg-elevated));
		border-bottom: 1px solid var(--clr-border);
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.chat-avatar {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md);
		background: var(--clr-gold-dim);
		border: 1px solid rgba(240, 165, 0, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
	}

	.chat-header-text { flex: 1; }
	.chat-name { font-weight: 700; font-size: 13px; }

	.chat-status {
		font-size: 10px;
		color: var(--clr-success);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--clr-success);
	}

	.chat-close {
		background: none;
		border: none;
		color: var(--clr-text-muted);
		cursor: pointer;
		font-size: 16px;
		padding: 4px;
		border-radius: var(--radius-sm);
		transition: background var(--duration-fast);
	}

	.chat-close:hover { background: var(--clr-bg-elevated); }

	.chat-messages {
		height: 340px;
		overflow-y: auto;
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.msg { display: flex; }
	.msg-user { justify-content: flex-end; }

	.msg-bubble {
		max-width: 85%;
		padding: 10px 14px;
		font-size: 13px;
		line-height: 1.6;
		border-radius: 12px;
		word-break: break-word;
	}

	.bubble-user {
		background: var(--clr-blue);
		color: white;
		border-bottom-right-radius: 4px;
	}

	.bubble-bot {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		color: var(--clr-text-primary);
		border-bottom-left-radius: 4px;
	}

	.typing-dots {
		display: flex;
		gap: 4px;
		align-items: center;
		padding: 2px 0;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--clr-text-muted);
		animation: pulse 1s infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }

	.quick-prompts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.quick-btn {
		font-size: 11px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: var(--clr-gold-dim);
		border: 1px solid rgba(240, 165, 0, 0.15);
		color: var(--clr-gold);
		cursor: pointer;
		font-family: inherit;
		transition: background var(--duration-fast);
	}

	.quick-btn:hover {
		background: rgba(240, 165, 0, 0.18);
	}

	.chat-input-area {
		padding: 10px 14px;
		border-top: 1px solid var(--clr-border);
		display: flex;
		gap: 8px;
		background: var(--clr-bg-deep);
	}

	.chat-input {
		flex: 1;
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		font-size: 13px;
		color: var(--clr-text-primary);
		outline: none;
		font-family: inherit;
		min-width: 0;
	}

	.chat-input:focus { border-color: var(--clr-border-focus); }

	.chat-send {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--clr-gold);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--clr-bg-deep);
		transition: background var(--duration-fast);
	}

	.chat-send:hover { background: #c88600; }

	@media (max-width: 640px) {
		.chat-widget { bottom: 16px; right: 16px; }
		.chat-window { width: calc(100vw - 32px); }
	}
</style>
