<script lang="ts">
	import { Bell, TrendingUp } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import * as api from '$lib/api/client';
	import Seo from '$lib/components/ui/Seo.svelte';

	let sites = $state<any[]>([]);
	let loading = $state(true);
	let maxSites = $state(0);
	let plan = $state('free');

	// Add site form
	let newUrl = $state('');
	let newFrequency = $state('weekly');
	let newThreshold = $state(5);
	let addLoading = $state(false);
	let addMsg = $state('');
	let addError = $state('');

	// Trend view
	let trendSiteId = $state<string | null>(null);
	let trendData = $state<any[]>([]);
	let trendUrl = $state('');
	let trendLoading = $state(false);

	const isPaid = $derived($auth.user?.plan === 'pro' || $auth.user?.plan === 'agency');

	onMount(async () => {
		if ($auth.user && isPaid) await loadSites();
		loading = false;
	});

	async function loadSites() {
		try {
			const res = await api.getMonitoredSites();
			sites = res.sites || [];
			maxSites = res.max_sites || 0;
			plan = res.plan || 'free';
		} catch { sites = []; }
	}

	async function addSite() {
		addError = ''; addMsg = '';
		if (!newUrl.trim()) { addError = 'Enter a URL to monitor.'; return; }
		addLoading = true;
		try {
			const res = await api.addMonitoredSite(newUrl.trim(), newFrequency, newThreshold);
			addMsg = res.message;
			newUrl = '';
			await loadSites();
		} catch (err) {
			addError = err instanceof Error ? err.message : 'Failed to add site.';
		}
		addLoading = false;
	}

	async function removeSite(id: string, url: string) {
		if (!confirm(`Stop monitoring ${url}?`)) return;
		try { await api.removeMonitoredSite(id); await loadSites(); } catch {}
	}

	async function triggerScan(id: string) {
		try {
			const res = await api.triggerMonitoringScan(id);
			addMsg = res.message + ' Results in ~30 seconds.';
			// Refresh after delay
			setTimeout(() => loadSites(), 35000);
		} catch (err) {
			addError = err instanceof Error ? err.message : 'Scan failed.';
		}
	}

	async function togglePause(site: any) {
		try {
			await api.updateMonitoredSite(site.id, { is_active: !site.is_active });
			await loadSites();
		} catch {}
	}

	async function viewTrend(site: any) {
		if (trendSiteId === site.id) { trendSiteId = null; return; }
		trendSiteId = site.id;
		trendUrl = site.url;
		trendLoading = true;
		try {
			const res = await api.getMonitoringTrend(site.id);
			trendData = res.trend || [];
		} catch { trendData = []; }
		trendLoading = false;
	}

	function scoreColor(score: number): string {
		if (score >= 80) return 'var(--clr-success)';
		if (score >= 60) return 'var(--clr-warning)';
		return 'var(--clr-danger)';
	}

	function formatDate(d: string): string {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function getDomain(url: string): string {
		return url?.replace('https://', '').replace('http://', '').split('/')[0] || '';
	}
</script>

<Seo
	title="Site Monitoring — Automated Website Health Alerts"
	description="Monitor your websites automatically. Get email and push notification alerts when scores drop. Track performance trends over time."
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "BSCAN Site Monitoring",
		"url": "https://bscan.balancewises.io/monitoring",
		"applicationCategory": "Monitoring Tool",
		"description": "Automated website monitoring with hourly checks. Receive email and push alerts when your site health score drops below threshold.",
		"operatingSystem": "All",
		"offers": { "@type": "Offer", "price": "9.00", "priceCurrency": "GBP", "description": "Starter plan — £9/month" }
	}}
/>

<div class="container" style="max-width: 900px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-blue"><Bell size={14} strokeWidth={2} /> MONITORING</span>
		<h1>Site <span class="text-gold">Monitoring</span></h1>
		<p class="text-secondary">Track your websites automatically. Get alerts when scores drop.</p>
	</div>

	{#if !$auth.user}
		<div class="card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 40px;">
				<div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
				<h3>Sign in to monitor sites</h3>
				<p class="text-muted" style="margin: 8px 0 20px;">Create an account and upgrade to Pro or Agency to start monitoring.</p>
				<a href="/account" class="btn btn-gold">Sign In →</a>
			</div>
		</div>
	{:else if !isPaid}
		<div class="card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 40px;">
				<div style="font-size: 48px; margin-bottom: 12px;"><Bell size={36} strokeWidth={1.5} /></div>
				<h3>Upgrade to Monitor Sites</h3>
				<p class="text-muted" style="margin: 8px 0 4px;">Automated scans run on your schedule — daily, weekly, or monthly.</p>
				<p class="text-muted" style="margin: 0 0 20px;">Get email alerts the moment a score drops.</p>
				<div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
					<button class="btn btn-gold" onclick={() => ui.openCheckout('pro')}>Pro — 3 sites · £9/mo</button>
					<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Agency — 10 sites · £29/mo</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Add Site -->
		<div class="card animate-fade-up" style="margin-bottom: 20px;">
			<div class="card-header">
				<span>➕</span>
				<span style="font-weight: 700;">Add Site to Monitor</span>
				<span class="text-muted" style="margin-left: auto; font-size: 11px;">{sites.length}/{maxSites} sites</span>
			</div>
			<div class="card-body">
				<div class="add-row">
					<input class="input" type="url" placeholder="https://yoursite.com" bind:value={newUrl} style="flex: 1;" onkeydown={(e) => e.key === 'Enter' && addSite()} />
					<select class="input" bind:value={newFrequency} style="width: 120px;">
						<option value="daily">Daily</option>
						<option value="weekly">Weekly</option>
						<option value="monthly">Monthly</option>
					</select>
					<button class="btn btn-gold" disabled={addLoading} onclick={addSite}>
						{#if addLoading}<span class="spinner spinner-sm"></span>{/if} Monitor
					</button>
				</div>
				<div class="add-options">
					<label class="text-muted" style="font-size: 11px;">
						Alert if score drops by
						<select bind:value={newThreshold} class="input" style="width: 60px; display: inline-block; padding: 4px 8px; font-size: 11px;">
							<option value={3}>3+</option>
							<option value={5}>5+</option>
							<option value={10}>10+</option>
							<option value={20}>20+</option>
						</select>
						points
					</label>
				</div>
				{#if addMsg}<div class="msg-success" style="margin-top: 8px;">{addMsg}</div>{/if}
				{#if addError}<div class="msg-error" style="margin-top: 8px;">{addError}</div>{/if}
			</div>
		</div>

		<!-- Monitored Sites List -->
		<div class="card animate-fade-up">
			<div class="card-header">
				<span><Bell size={14} strokeWidth={2} /></span>
				<span style="font-weight: 700;">Monitored Sites</span>
			</div>
			<div class="card-body" style="padding: 0;">
				{#if loading}
					<div class="empty-state"><p class="text-muted">Loading...</p></div>
				{:else if sites.length === 0}
					<div class="empty-state">
						<div style="font-size: 36px; margin-bottom: 8px;"><Bell size={36} strokeWidth={1.5} /></div>
						<p class="text-muted">No sites monitored yet. Add one above.</p>
					</div>
				{:else}
					{#each sites as site}
						<div class="site-row" class:paused={!site.is_active}>
							<div class="site-info">
								<div class="site-url">{getDomain(site.url)}</div>
								<div class="site-meta text-muted">
									{site.frequency} · threshold: {site.alert_threshold}pt
									{#if site.last_scanned_at}
										· last: {formatDate(site.last_scanned_at)}
									{:else}
										· <span style="color: var(--clr-warning);">not yet scanned</span>
									{/if}
								</div>
							</div>

							{#if site.last_score != null}
								<div class="site-score" style="color: {scoreColor(site.last_score)};">
									{site.last_score}
								</div>
							{:else}
								<div class="site-score text-muted">—</div>
							{/if}

							<div class="site-actions">
								<button class="btn btn-ghost btn-sm" title="View trend" onclick={() => viewTrend(site)}>
									<TrendingUp size={14} strokeWidth={2} />
								</button>
								<button class="btn btn-ghost btn-sm" title="Scan now" onclick={() => triggerScan(site.id)}>
									🔄
								</button>
								<button class="btn btn-ghost btn-sm" title={site.is_active ? 'Pause' : 'Resume'} onclick={() => togglePause(site)}>
									{site.is_active ? '⏸️' : '▶️'}
								</button>
								<button class="btn btn-ghost btn-sm" title="Remove" style="color: var(--clr-danger);" onclick={() => removeSite(site.id, site.url)}>
									🗑️
								</button>
							</div>
						</div>

						<!-- Trend Panel (expandable) -->
						{#if trendSiteId === site.id}
							<div class="trend-panel">
								{#if trendLoading}
									<p class="text-muted" style="text-align: center; padding: 20px;">Loading trend data...</p>
								{:else if trendData.length === 0}
									<p class="text-muted" style="text-align: center; padding: 20px;">No scan history yet. Trigger a scan first.</p>
								{:else}
									<div class="trend-header">
										<span style="font-weight: 700; font-size: 13px;">Score History — {getDomain(trendUrl)}</span>
										<span class="text-muted" style="font-size: 11px;">{trendData.length} scans</span>
									</div>

									<!-- Simple bar chart -->
									<div class="trend-chart">
										{#each trendData as point, i}
											{@const height = Math.max(8, (point.overall || 0))}
											<div class="trend-bar-wrap" title="{point.date}: {point.overall}/100">
												<div class="trend-bar" style="height: {height}%; background: {scoreColor(point.overall || 0)};"></div>
												<div class="trend-label">{point.overall}</div>
											</div>
										{/each}
									</div>

									<!-- Category breakdown for latest scan -->
									{@const latest = trendData[trendData.length - 1]}
									<div class="trend-categories">
										{#each [['SEO', latest.seo], ['Perf', latest.performance], ['A11y', latest.accessibility], ['Security', latest.security], ['Mobile', latest.mobile], ['Links', latest.links]] as [label, score]}
											<div class="trend-cat">
												<div class="trend-cat-label text-muted">{label}</div>
												<div class="trend-cat-score" style="color: {scoreColor(score || 0)};">{score || '—'}</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		</div>

		<!-- How it works -->
		<div class="card animate-fade-up" style="margin-top: 20px;">
			<div class="card-header">
				<span>ℹ️</span>
				<span style="font-weight: 700;">How Monitoring Works</span>
			</div>
			<div class="card-body">
				<div class="how-grid">
					<div class="how-item">
						<div class="how-icon"><Bell size={36} strokeWidth={1.5} /></div>
						<div class="how-text"><strong>Automatic Scans</strong><br><span class="text-muted">We scan your sites on schedule — daily, weekly, or monthly.</span></div>
					</div>
					<div class="how-item">
						<div class="how-icon">📉</div>
						<div class="how-text"><strong>Score Alerts</strong><br><span class="text-muted">Get an email when a score drops below your threshold.</span></div>
					</div>
					<div class="how-item">
						<div class="how-icon"><TrendingUp size={20} strokeWidth={1.8} /></div>
						<div class="how-text"><strong>Trend Charts</strong><br><span class="text-muted">See how your scores change over time.</span></div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-header { text-align: center; margin-bottom: var(--space-xl); }
	.page-header h1 { font-style: italic; margin: 8px 0; }

	.add-row { display: flex; gap: 8px; flex-wrap: wrap; }
	.add-options { margin-top: 10px; }

	.empty-state { text-align: center; padding: 40px; }

	.site-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--clr-border); transition: background 0.15s; }
	.site-row:last-child { border-bottom: none; }
	.site-row:hover { background: rgba(255,255,255,0.02); }
	.site-row.paused { opacity: 0.5; }

	.site-info { flex: 1; min-width: 0; }
	.site-url { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--clr-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.site-meta { font-size: 11px; margin-top: 2px; }

	.site-score { font-size: 28px; font-weight: 800; flex-shrink: 0; min-width: 50px; text-align: center; }

	.site-actions { display: flex; gap: 2px; flex-shrink: 0; }

	/* Trend panel */
	.trend-panel { padding: 16px; background: var(--clr-bg-deep); border-bottom: 1px solid var(--clr-border); }
	.trend-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }

	.trend-chart { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding: 8px 0; }
	.trend-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; cursor: pointer; }
	.trend-bar { width: 100%; max-width: 24px; border-radius: 3px 3px 0 0; transition: height 0.3s; min-height: 4px; }
	.trend-label { font-size: 9px; color: var(--clr-text-muted); margin-top: 4px; font-family: var(--font-mono); }

	.trend-categories { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
	.trend-cat { text-align: center; flex: 1; min-width: 50px; padding: 8px; background: var(--clr-bg-card); border-radius: var(--radius-sm); border: 1px solid var(--clr-border); }
	.trend-cat-label { font-size: 10px; text-transform: uppercase; font-family: var(--font-mono); letter-spacing: 0.3px; }
	.trend-cat-score { font-size: 18px; font-weight: 800; margin-top: 2px; }

	/* How it works */
	.how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
	.how-item { display: flex; gap: 10px; align-items: flex-start; }
	.how-icon { font-size: 24px; flex-shrink: 0; }
	.how-text { font-size: 12px; line-height: 1.5; }

	.msg-success { padding: 8px 12px; border-radius: 6px; font-size: 12px; background: rgba(16,185,129,0.1); color: var(--clr-success); }
	.msg-error { padding: 8px 12px; border-radius: 6px; font-size: 12px; background: rgba(239,68,68,0.1); color: var(--clr-danger); }

	@media (max-width: 640px) {
		.add-row { flex-direction: column; }
		.add-row select { width: 100% !important; }
		.site-row { flex-wrap: wrap; }
		.site-actions { width: 100%; justify-content: flex-end; }
		.how-grid { grid-template-columns: 1fr; }
		.trend-categories { gap: 4px; }
		.trend-cat { min-width: 40px; }
	}
</style>
