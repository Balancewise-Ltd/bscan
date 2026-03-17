import { writable, derived, get } from 'svelte/store';
import type { ChatMessage } from '$lib/types';
import * as api from '$lib/api/client';

const _messages = writable<ChatMessage[]>([
	{
		role: 'assistant',
		content: "Hi! I'm your BSCAN assistant. I can help you understand your scan results, explain what scores mean, and show you how to fix issues.",
		timestamp: Date.now()
	}
]);
const _isOpen = writable(false);
const _isTyping = writable(false);
const _hasUnread = writable(false);
const _scanId = writable<string | null>(null);

const _store = derived(
	[_messages, _isOpen, _isTyping, _hasUnread],
	([$messages, $isOpen, $isTyping, $hasUnread]) => ({
		messages: $messages,
		isOpen: $isOpen,
		isTyping: $isTyping,
		hasUnread: $hasUnread
	})
);

// Show unread after 8s
if (typeof window !== 'undefined') {
	setTimeout(() => {
		if (!get(_isOpen)) _hasUnread.set(true);
	}, 8000);
}

function toggle() {
	_isOpen.update((v) => {
		if (!v) _hasUnread.set(false);
		return !v;
	});
}

function close() { _isOpen.set(false); }

function setScanId(id: string | null) { _scanId.set(id); }

async function send(text: string) {
	if (!text.trim()) return;
	_messages.update((m) => [...m, { role: 'user', content: text, timestamp: Date.now() }]);
	_isTyping.set(true);

	try {
		const history = get(_messages).map((m) => ({ role: m.role, content: m.content }));
		const response = await api.sendChatMessage(text, get(_scanId), history);
		_messages.update((m) => [...m, {
			role: 'assistant',
			content: response.reply || 'Sorry, I could not generate a response.',
			timestamp: Date.now()
		}]);
		if (response.scan_id) _scanId.set(response.scan_id);
	} catch {
		_messages.update((m) => [...m, {
			role: 'assistant',
			content: 'Connection error. Please try again.',
			timestamp: Date.now()
		}]);
	}
	_isTyping.set(false);
}

export const chat = {
	subscribe: _store.subscribe,
	toggle,
	close,
	setScanId,
	send
};
