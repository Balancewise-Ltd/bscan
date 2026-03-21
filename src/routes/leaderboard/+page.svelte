<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '$lib/api/client';
	import type { LeaderboardEntry, LeaderboardPeriod } from '$lib/types';
	import { scoreColor } from '$lib/utils/score';
	import { sanitize, safeFaviconUrl } from '$lib/utils/security';
	import Seo from '$lib/components/ui/Seo.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	let period: LeaderboardPeriod = $state('week');
	let entries = $state<LeaderboardEntry[]>([]);
	let loading = $state(true);

	onMount(() => loadBoard('week'));

	async function loadBoard(p: LeaderboardPeriod) {
		period = p;
		loading = true;
		try {
			const data = await api.getLeaderboard(p, 25);
			entries = data.leaderboard || [];
		} catch {
			entries = [];
		}
		loading = false;
	}

	function medal(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return String(rank);
	}

	function rankClass(rank: number): string {
		if (rank === 1) return 'gold';
		if (rank === 2) return 'silver';
		if (rank === 3) return 'bronze';
		return '';
	}
</script>

<Seo
	title="Website Leaderboard — Top Scoring Sites"
	description="See the top-performing websites on BSCAN. Public rankings showing SEO, performance, and security scores. Can your site make the top 10?"
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "ItemList",
		"name": "BSCAN Website Leaderboard",
		"description": "Public rankings of top-performing websites scored by BSCAN across SEO, performance, accessibility, and security.",
		"url": "https://bscan.balancewises.io/leaderboard",
		"itemListOrder": "https://schema.org/ItemListOrderDescending",
		"numberOfItems": 20
	}}
/>

<div class="container" style="max-width: 800px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-gold">🏆 Leaderboard</span>
		<h1>Top <span class="text-gold">Websites</span></h1>
		<p class="text-secondary">See how the best-performing websites stack up.</p>

		<div class="tabs">
			<button class="tab" class:active={period === 'week'} onclick={() => loadBoard('week')}>This Week</button>
			<button class="tab" class:active={period === 'month'} onclick={() => loadBoard('month')}>This Month</button>
			<button class="tab" class:active={period === 'all'} onclick={() => loadBoard('all')}>All Time</button>
		</div>
	</div>

	<div class="board card animate-fade-up" style="animation-delay: 0.1s;">
		<!-- Header -->
		<div class="board-header">
			<span class="col-rank">#</span>
			<span class="col-site">Website</span>
			<span class="col-score">Score</span>
			<span class="col-mini">SEO</span>
			<span class="col-mini">Security</span>
		</div>

		{#if loading}
			<div style="padding: 16px 20px;">
				{#each Array(8) as _}
					<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0;">
						<Skeleton variant="circle" width="28px" />
						<Skeleton variant="bar" width="60%" height="14px" />
						<Skeleton variant="bar" width="40px" height="18px" />
					</div>
				{/each}
			</div>
		{:else if entries.length === 0}
			<div class="empty-state">
				<p class="text-muted">No scans yet this period. <a href="/">Be the first! →</a></p>
			</div>
		{:else}
			{#each entries as entry, i}
				{@const rank = i + 1}
				<div class="board-row">
					<span class="col-rank {rankClass(rank)}">{medal(rank)}</span>
					<span class="col-site">
						<img class="favicon" src={safeFaviconUrl(entry.domain)} alt="" loading="lazy" />
						{sanitize(entry.domain)}
					</span>
					<span class="col-score" style="color: {scoreColor(entry.overall_score)};">{entry.overall_score}</span>
					<span class="col-mini text-muted">{entry.seo_score ?? '-'}</span>
					<span class="col-mini text-muted">{entry.security_score ?? '-'}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.page-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.page-header h1 { font-style: italic; margin: 8px 0; }

	.tabs {
		display: inline-flex;
		gap: 4px;
		margin-top: var(--space-md);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 3px;
	}

	.tab {
		padding: 8px 18px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-family: inherit;
		background: transparent;
		color: var(--clr-text-secondary);
		transition: all var(--duration-fast);
	}

	.tab.active {
		background: var(--clr-blue);
		color: white;
	}

	.board-header, .board-row {
		display: grid;
		grid-template-columns: 48px 1fr 64px 56px 56px;
		align-items: center;
		padding: 12px 20px;
		gap: 8px;
	}

	.board-header {
		border-bottom: 1px solid var(--clr-border);
		font-size: 10px;
		font-weight: 700;
		color: var(--clr-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-family: var(--font-mono);
	}

	.board-row {
		border-bottom: 1px solid var(--clr-border);
		transition: background var(--duration-fast);
	}

	.board-row:last-child { border-bottom: none; }
	.board-row:hover { background: var(--clr-bg-primary); }

	.col-rank {
		font-weight: 700;
		font-size: 14px;
		text-align: center;
	}

	.col-rank.gold { color: var(--clr-gold); }
	.col-rank.silver { color: var(--clr-text-secondary); }
	.col-rank.bronze { color: #cd7f32; }

	.col-site {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		font-weight: 500;
	}

	.favicon {
		width: 18px;
		height: 18px;
		border-radius: 3px;
	}

	.col-score {
		font-size: 18px;
		font-weight: 800;
		font-family: var(--font-mono);
		text-align: center;
	}

	.col-mini {
		font-size: 12px;
		font-family: var(--font-mono);
		text-align: center;
	}

	.empty-state {
		padding: var(--space-xl);
		text-align: center;
	}

	@media (max-width: 640px) {
		.board-header, .board-row {
			grid-template-columns: 40px 1fr 56px;
			padding: 10px 14px;
		}
		.col-mini { display: none; }
	}
</style>
