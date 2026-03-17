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
		const handler = (event: ErrorEvent) => {
			hasError = true;
			errorMsg = event.message || 'An unexpected error occurred';
			event.preventDefault();
		};
		window.addEventListener('error', handler);
		return () => window.removeEventListener('error', handler);
	});

	function retry() {
		hasError = false;
		errorMsg = '';
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
