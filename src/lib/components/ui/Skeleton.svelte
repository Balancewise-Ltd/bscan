<script lang="ts">
	interface Props {
		lines?: number;
		height?: string;
		variant?: 'text' | 'card' | 'circle' | 'bar';
		width?: string;
	}

	let { lines = 3, height = '14px', variant = 'text', width = '100%' }: Props = $props();
</script>

{#if variant === 'card'}
	<div class="skeleton-card">
		<div class="skeleton-line" style="width: 40%; height: 18px;"></div>
		<div class="skeleton-line" style="width: 80%; height: {height};"></div>
		<div class="skeleton-line" style="width: 60%; height: {height};"></div>
	</div>
{:else if variant === 'circle'}
	<div class="skeleton-circle" style="width: {width}; height: {width};"></div>
{:else if variant === 'bar'}
	<div class="skeleton-bar" style="width: {width}; height: {height};"></div>
{:else}
	<div class="skeleton-text">
		{#each Array(lines) as _, i}
			<div
				class="skeleton-line"
				style="width: {i === lines - 1 ? '60%' : '100%'}; height: {height};"
			></div>
		{/each}
	</div>
{/if}

<style>
	.skeleton-line {
		background: linear-gradient(90deg, var(--clr-border) 25%, var(--clr-border-light) 50%, var(--clr-border) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	.skeleton-text {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.skeleton-circle {
		border-radius: 50%;
		background: linear-gradient(90deg, var(--clr-border) 25%, var(--clr-border-light) 50%, var(--clr-border) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	.skeleton-bar {
		background: linear-gradient(90deg, var(--clr-border) 25%, var(--clr-border-light) 50%, var(--clr-border) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-sm);
	}
</style>
