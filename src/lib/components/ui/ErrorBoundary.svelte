<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		fallbackMessage?: string;
		children: any;
	}

	let { fallbackMessage = 'Something went wrong. Please try refreshing the page.', children }: Props = $props();

	let hasError = $state(false);
	let errorMsg = $state('');

	onMount(() => {
		// Only catch errors from our own app scripts, not third-party
		const handler = (event: ErrorEvent) => {
			// Ignore errors from third-party scripts (different origin)
			if (event.filename && !event.filename.includes('/_app/')) return;
			// Ignore errors with no filename (browser extensions, injected scripts)
			if (!event.filename && !event.error) return;
			// Ignore ResizeObserver errors (browser quirk, not a real problem)
			if (event.message?.includes('ResizeObserver')) return;
			// Ignore cross-origin script errors (generic "Script error.")
			if (event.message === 'Script error.' || event.message === 'Script error') return;

			hasError = true;
			errorMsg = event.message || 'An unexpected error occurred';
			event.preventDefault();
		};

		const promiseHandler = (event: PromiseRejectionEvent) => {
			// Only catch unhandled promise rejections from app code
			const msg = event.reason?.message || String(event.reason || '');
			// Ignore common non-critical rejections
			if (msg.includes('AbortError') || msg.includes('NetworkError') || msg.includes('fetch')) return;
			// Don't show error boundary for API failures — pages handle those
			if (msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('500')) return;
		};

		window.addEventListener('error', handler);
		window.addEventListener('unhandledrejection', promiseHandler);
		return () => {
			window.removeEventListener('error', handler);
			window.removeEventListener('unhandledrejection', promiseHandler);
		};
	});

	function retry() {
		hasError = false;
		errorMsg = '';
		window.location.reload();
	}
</script>

{#if hasError}
	<div class="error-boundary">
		<div class="error-icon">⚠️</div>
		<h3>Oops</h3>
		<p>{fallbackMessage}</p>
		{#if errorMsg}
			<details class="error-details">
				<summary>Technical details</summary>
				<code>{errorMsg}</code>
			</details>
		{/if}
		<button class="btn btn-outline" style="margin-top: 12px;" onclick={retry}>Try Again</button>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary {
		text-align: center;
		padding: var(--space-xl);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-danger-dim);
		border-radius: var(--radius-lg);
		max-width: 500px;
		margin: var(--space-xl) auto;
	}

	.error-icon { font-size: 32px; margin-bottom: 8px; }

	.error-boundary h3 {
		margin-bottom: 4px;
	}

	.error-boundary p {
		font-size: 13px;
		color: var(--clr-text-secondary);
		line-height: 1.6;
	}

	.error-details {
		margin-top: 12px;
		text-align: left;
	}

	.error-details summary {
		font-size: 11px;
		color: var(--clr-text-muted);
		cursor: pointer;
	}

	.error-details code {
		display: block;
		margin-top: 6px;
		padding: 8px;
		background: var(--clr-bg-primary);
		border-radius: var(--radius-sm);
		font-size: 10px;
		color: var(--clr-danger);
		font-family: var(--font-mono);
		word-break: break-all;
	}
</style>
