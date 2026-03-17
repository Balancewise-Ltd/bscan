<script lang="ts">
	import { page } from '$app/stores';

	const status = $derived($page.status);
	const message = $derived($page.error?.message || 'Something went wrong');

	const is404 = $derived(status === 404);
</script>

<div class="error-page">
	<div class="error-content animate-fade-up">
		<div class="error-code">{status}</div>
		<h1>
			{#if is404}
				Page not found
			{:else}
				Something went wrong
			{/if}
		</h1>
		<p class="text-secondary">
			{#if is404}
				The page you're looking for doesn't exist or has been moved.
			{:else}
				{message}
			{/if}
		</p>
		<div class="error-actions">
			<a href="/" class="btn btn-gold">Back to Scanner</a>
			<a href="/account" class="btn btn-outline">Go to Account</a>
		</div>
	</div>
</div>

<style>
	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: var(--space-xl);
	}

	.error-content {
		text-align: center;
		max-width: 480px;
	}

	.error-code {
		font-size: clamp(72px, 15vw, 120px);
		font-weight: 800;
		font-family: var(--font-mono);
		letter-spacing: -4px;
		background: linear-gradient(135deg, var(--clr-gold), var(--clr-blue));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		line-height: 1;
		margin-bottom: var(--space-md);
	}

	h1 {
		font-size: clamp(20px, 4vw, 28px);
		margin-bottom: var(--space-sm);
	}

	p {
		font-size: 14px;
		line-height: 1.6;
		margin-bottom: var(--space-lg);
	}

	.error-actions {
		display: flex;
		gap: 10px;
		justify-content: center;
		flex-wrap: wrap;
	}
</style>
