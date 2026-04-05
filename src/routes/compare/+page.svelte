<script lang="ts">
	import { Scale, ClipboardList } from '@lucide/svelte';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { normalizeUrl, scoreColor, formatDate } from '$lib/utils/score';
	import { sanitize } from '$lib/utils/security';
	import * as api from '$lib/api/client';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Seo from '$lib/components/ui/Seo.svelte';

	type CompareTab = 'compare' | 'history';
	let activeTab = $state<CompareTab>('compare');

	let url1 = $state('');
	let url2 = $state('');
	let results = $state<any>(null);
	let loading = $state(false);
	let error = $state('');

	// History
	let historyItems = $state<any[]>([]);
	let histLoading = $state(false);

	const isPaid = $derived($auth.user?.plan === 'pro' || $auth.user?.plan === 'agency');

	async function compare() {
		if (!url1.trim() || !url2.trim()) return;
		error = '';
		loading = true;
		try {
			const raw = await api.compareSites(normalizeUrl(url1), normalizeUrl(url2));
			// Backend returns scores nested: site_a.scores.overall
			// Frontend expects flat: site_a.overall_score
			function flattenSite(site: any) {
				if (!site) return site;
				const scores = site.scores || {};
				return {
					...site,
					overall_score: scores.overall ?? site.overall_score ?? 0,
					seo_score: scores.seo ?? site.seo_score ?? 0,
					performance_score: scores.performance ?? site.performance_score ?? 0,
					accessibility_score: scores.accessibility ?? site.accessibility_score ?? 0,
					security_score: scores.security ?? site.security_score ?? 0,
					mobile_score: scores.mobile ?? site.mobile_score ?? 0,
					links_score: scores.links ?? site.links_score ?? 0,
				};
			}
			if (raw.site_a) raw.site_a = flattenSite(raw.site_a);
			if (raw.site_b) raw.site_b = flattenSite(raw.site_b);
			results = raw;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Comparison failed.';
			results = null;
		}
		loading = false;
	}

	async function loadHistory() {
		histLoading = true;
		try {
			const res = await api.getCompareHistory();
			historyItems = res.items || res || [];
		} catch { historyItems = []; }
		histLoading = false;
	}

	const categories = ['seo', 'performance', 'accessibility', 'security', 'mobile', 'links'];
</script>

<Seo
	title="Compare Websites — Side-by-Side SEO & Performance Analysis"
	description="Compare two websites side-by-side across SEO, performance, accessibility, security, and more. See who wins in every category."
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "BSCAN Website Comparator",
		"url": "https://bscan.balancewises.io/compare",
		"applicationCategory": "SEO Tool",
		"description": "Compare two websites side-by-side across SEO, performance, accessibility, and security. See detailed category breakdowns and a winner for each metric.",
		"operatingSystem": "All",
		"offers": { "@type": "Offer", "price": "0.00", "priceCurrency": "GBP" }
	}}
/>

<div class="container" style="max-width: 900px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-gold"><Scale size={14} strokeWidth={2} /> Compare</span>
		<h1>Compare <span class="text-gold">Websites</span></h1>
		<p class="text-secondary">See how two websites stack up side-by-side across all audit categories.</p>
	</div>

	{#if !$auth.user}
		<div class="gate-card card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 48px;">
				<div style="font-size: 32px; margin-bottom: 12px;">🔐</div>
				<h3>Sign in to compare websites</h3>
				<p class="text-secondary" style="margin: 8px 0 20px;">Compare is available on Pro and Agency plans.</p>
				<a href="/account" class="btn btn-gold">Sign In</a>
			</div>
		</div>
	{:else if !isPaid}
		<div class="gate-card card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 48px;">
				<div style="font-size: 32px; margin-bottom: 12px;"><Scale size={28} strokeWidth={1.5} /></div>
				<h3>Upgrade to unlock Compare</h3>
				<p class="text-secondary" style="margin: 8px 0 20px;">Side-by-side website comparison is a Starter feature.</p>
				<button class="btn btn-gold" onclick={() => ui.openCheckout('pro')}>Upgrade to Starter — £9/mo</button>
			</div>
		</div>
	{:else}
		<!-- Tabs -->
		<div class="tabs-row animate-fade-up">
			<button class="cmp-tab" class:active={activeTab === 'compare'} onclick={() => activeTab = 'compare'}><Scale size={14} strokeWidth={2} /> Compare</button>
			<button class="cmp-tab" class:active={activeTab === 'history'} onclick={() => { activeTab = 'history'; loadHistory(); }}><ClipboardList size={14} strokeWidth={2} /> History</button>
		</div>

		{#if activeTab === 'compare'}
		<div class="compare-tool animate-fade-up">
			<div class="compare-inputs">
				<div class="compare-field">
					<label class="label" for="cmp-url-a">Website A</label>
					<input class="input" id="cmp-url-a" type="url" placeholder="https://yoursite.com" bind:value={url1} onkeydown={(e) => e.key === 'Enter' && compare()} />
				</div>
				<div class="vs-badge">VS</div>
				<div class="compare-field">
					<label class="label" for="cmp-url-b">Website B</label>
					<input class="input" id="cmp-url-b" type="url" placeholder="https://competitor.com" bind:value={url2} onkeydown={(e) => e.key === 'Enter' && compare()} />
				</div>
			</div>

			<button class="btn btn-gold" style="width: 100%; margin-top: 16px;" disabled={loading} onclick={compare}>
				{#if loading}<span class="spinner spinner-sm"></span> Comparing...{:else}<Scale size={14} strokeWidth={2} /> Compare Now{/if}
			</button>

			{#if error}
				<div class="error-box">{error}</div>
			{/if}

			{#if results}
				{@const a = results.site_a || results.siteA || {}}
				{@const b = results.site_b || results.siteB || {}}
				<div class="compare-results">
					<!-- Overall -->
					<div class="compare-row overall-compare">
						<div class="compare-cell" style="color: {scoreColor(a.overall_score || 0)};">
							<div class="compare-score">{a.overall_score || 0}</div>
							<div class="compare-url font-mono">{url1.replace('https://', '').split('/')[0]}</div>
						</div>
						<div class="compare-label">Overall</div>
						<div class="compare-cell" style="color: {scoreColor(b.overall_score || 0)};">
							<div class="compare-score">{b.overall_score || 0}</div>
							<div class="compare-url font-mono">{url2.replace('https://', '').split('/')[0]}</div>
						</div>
					</div>

					<!-- Category Rows -->
					{#each categories as cat}
						{@const scoreA = a[`${cat}_score`] || 0}
						{@const scoreB = b[`${cat}_score`] || 0}
						{@const winner = scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie'}
						<div class="compare-row">
							<div class="compare-cell" class:winner={winner === 'a'}>
								<span class="cat-score" style="color: {scoreColor(scoreA)};">{scoreA}</span>
							</div>
							<div class="compare-label">{cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
							<div class="compare-cell" class:winner={winner === 'b'}>
								<span class="cat-score" style="color: {scoreColor(scoreB)};">{scoreB}</span>
							</div>
						</div>
					{/each}

					<!-- Tech Stack Comparison -->
					{#if a.enrichment?.tech_stack?.technologies?.length || b.enrichment?.tech_stack?.technologies?.length}
						{@const techA = new Set(a.enrichment?.tech_stack?.technologies || [])}
						{@const techB = new Set(b.enrichment?.tech_stack?.technologies || [])}
						{@const shared = [...techA].filter(t => techB.has(t))}
						{@const onlyA = [...techA].filter(t => !techB.has(t))}
						{@const onlyB = [...techB].filter(t => !techA.has(t))}
						<div class="tech-compare">
							<div class="section-title">⚙️ Tech Stack Comparison</div>
							{#if shared.length}
								<div class="tech-group">
									<div class="tech-group-label text-muted">Shared ({shared.length})</div>
									<div class="tech-tags">
										{#each shared as t}<span class="tech-tag shared">{sanitize(t as string)}</span>{/each}
									</div>
								</div>
							{/if}
							{#if onlyA.length}
								<div class="tech-group">
									<div class="tech-group-label" style="color: var(--clr-blue);">Only {url1.replace('https://','').split('/')[0]} ({onlyA.length})</div>
									<div class="tech-tags">
										{#each onlyA as t}<span class="tech-tag side-a">{sanitize(t as string)}</span>{/each}
									</div>
								</div>
							{/if}
							{#if onlyB.length}
								<div class="tech-group">
									<div class="tech-group-label" style="color: var(--clr-gold);">Only {url2.replace('https://','').split('/')[0]} ({onlyB.length})</div>
									<div class="tech-tags">
										{#each onlyB as t}<span class="tech-tag side-b">{sanitize(t as string)}</span>{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Actionable Insights -->
					{#if results.insights?.length}
						<div class="insights-section">
							<div class="section-title">💡 Insights ({results.insights.length})</div>
							{#each results.insights as insight}
								<div class="insight-card">
									<span class="insight-icon">{insight.icon || '💡'}</span>
									<div class="insight-content">
										<div class="insight-title">
											{#if insight.winner}
												<strong style="color: var(--clr-gold);">{sanitize(insight.winner)}</strong> —
											{/if}
											{sanitize(insight.title)}
										</div>
										{#if insight.detail}
											<div class="insight-detail text-muted">{sanitize(insight.detail)}</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
		{/if}

		<!-- History Tab -->
		{#if activeTab === 'history'}
			<div class="animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span><ClipboardList size={14} strokeWidth={2} /></span>
						<span style="font-weight: 700; font-size: 14px;">Compare History</span>
					</div>
					<div class="card-body">
						{#if histLoading}
							<Skeleton lines={4} />
						{:else if historyItems.length === 0}
							<div style="text-align: center; padding: 32px;">
								<div style="font-size: 24px; margin-bottom: 8px;"><Scale size={28} strokeWidth={1.5} /></div>
								<p class="text-muted">No comparisons yet. Run your first comparison above!</p>
							</div>
						{:else}
							{#each historyItems as item}
								<div class="hist-row">
									<div class="hist-sites">
										<span class="font-mono">{sanitize(item.url_a || item.domain_a || '—')}</span>
										<span class="hist-vs">vs</span>
										<span class="font-mono">{sanitize(item.url_b || item.domain_b || '—')}</span>
									</div>
									{#if item.score_a != null && item.score_b != null}
										<div class="hist-scores">
											<span class="hist-score" style="color: {scoreColor(item.score_a)};">{item.score_a}</span>
											<span class="text-muted">—</span>
											<span class="hist-score" style="color: {scoreColor(item.score_b)};">{item.score_b}</span>
										</div>
									{/if}
									<div class="hist-date text-muted">{item.created_at ? formatDate(item.created_at) : ''}</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.page-header h1 { font-style: italic; margin: 8px 0; }

	.compare-inputs {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: var(--space-md);
		align-items: end;
	}

	.vs-badge {
		font-size: 14px;
		font-weight: 800;
		color: var(--clr-gold);
		padding: 12px 0;
		font-family: var(--font-mono);
	}

	.error-box {
		margin-top: 12px;
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		background: var(--clr-danger-dim);
		color: var(--clr-danger);
		font-size: 12px;
	}

	.compare-results {
		margin-top: var(--space-xl);
	}

	.compare-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: var(--space-md);
		align-items: center;
		padding: 14px 0;
		border-bottom: 1px solid var(--clr-border);
	}

	.compare-row:last-child { border-bottom: none; }

	.overall-compare {
		padding: var(--space-lg) 0;
		margin-bottom: var(--space-md);
	}

	.compare-cell {
		text-align: center;
		padding: 8px;
		border-radius: var(--radius-md);
		transition: background var(--duration-fast);
	}

	.compare-cell.winner {
		background: rgba(16, 185, 129, 0.06);
		border: 1px solid rgba(16, 185, 129, 0.15);
	}

	.compare-score {
		font-size: 36px;
		font-weight: 800;
		font-family: var(--font-mono);
		letter-spacing: -2px;
	}

	.compare-url {
		font-size: 11px;
		color: var(--clr-text-muted);
		margin-top: 4px;
	}

	.compare-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--clr-text-muted);
		text-align: center;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.cat-score {
		font-size: 22px;
		font-weight: 800;
		font-family: var(--font-mono);
	}

	@media (max-width: 640px) {
		.compare-inputs {
			grid-template-columns: 1fr;
		}
		.vs-badge {
			text-align: center;
			padding: 0;
		}
	}

	/* ── Tabs ──────────────────────────────── */
	.tabs-row {
		display: flex;
		gap: 4px;
		margin-bottom: var(--space-md);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 4px;
	}

	.cmp-tab {
		padding: 10px 18px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-family: inherit;
		background: transparent;
		color: var(--clr-text-secondary);
		transition: all var(--duration-fast);
		white-space: nowrap;
	}

	.cmp-tab.active {
		background: var(--clr-blue);
		color: white;
	}

	/* ── History ───────────────────────────── */
	.hist-row {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: 12px 0;
		border-bottom: 1px solid var(--clr-border);
		flex-wrap: wrap;
	}

	.hist-row:last-child { border-bottom: none; }

	.hist-sites {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--clr-text-secondary);
		min-width: 0;
		overflow: hidden;
	}

	.hist-vs {
		color: var(--clr-text-muted);
		font-size: 10px;
		font-family: var(--font-mono);
		font-weight: 700;
	}

	.hist-scores {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.hist-score {
		font-size: 16px;
		font-weight: 800;
		font-family: var(--font-mono);
	}

	.hist-date { font-size: 11px; flex-shrink: 0; }
</style>
