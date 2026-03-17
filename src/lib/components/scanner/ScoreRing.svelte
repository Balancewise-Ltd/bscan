<script lang="ts">
	import { onMount } from 'svelte';
	import { scoreColor, animateNumber } from '$lib/utils/score';

	interface Props {
		score: number;
		size?: number;
		strokeWidth?: number;
	}

	let { score, size = 110, strokeWidth = 8 }: Props = $props();

	let displayScore = $state(0);
	let offset = $state(295.31);

	const radius = $derived((size - strokeWidth) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const center = $derived(size / 2);
	const color = $derived(scoreColor(score));

	onMount(() => {
		requestAnimationFrame(() => {
			offset = circumference - (score / 100) * circumference;
			animateNumber((v) => (displayScore = v), 0, score, 1200);
		});
	});
</script>

<div class="ring-container" style="width: {size}px; height: {size}px;">
	<svg viewBox="0 0 {size} {size}" class="ring-svg">
		<circle
			class="ring-bg"
			cx={center}
			cy={center}
			r={radius}
			stroke-width={strokeWidth}
		/>
		<circle
			class="ring-fg"
			cx={center}
			cy={center}
			r={radius}
			stroke-width={strokeWidth}
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			style="stroke: {color};"
		/>
	</svg>
	<div class="ring-label">
		<span class="ring-num" style="color: {color};">{displayScore}</span>
		<span class="ring-sub">Overall</span>
	</div>
</div>

<style>
	.ring-container {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.ring-svg {
		transform: rotate(-90deg);
	}

	.ring-bg {
		fill: none;
		stroke: var(--clr-border);
		opacity: 0.5;
	}

	.ring-fg {
		fill: none;
		stroke-linecap: round;
		transition: stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1);
		filter: drop-shadow(0 0 6px currentColor);
	}

	.ring-label {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.ring-num {
		font-size: 32px;
		font-weight: 800;
		letter-spacing: -2px;
		line-height: 1;
	}

	.ring-sub {
		font-size: 10px;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-top: 2px;
	}
</style>
