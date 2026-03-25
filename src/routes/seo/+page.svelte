<script lang="ts">
	import { BarChart3, Search, Link2, TrendingUp, ClipboardList, Target, Scale, ExternalLink } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { sanitize, safeRedirect, safeGetStorage } from '$lib/utils/security';
	import * as api from '$lib/api/client';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Seo from '$lib/components/ui/Seo.svelte';

	let activeTab = $state('keywords');
	let gscLoading = $state(false);
	let gscError = $state('');
	let gscSuccess = $state('');
	const isLoggedIn = $derived(!!$auth.user);
	const isPaid = $derived($auth.user?.plan === 'pro' || $auth.user?.plan === 'agency');
	const isAgency = $derived($auth.user?.plan === 'agency');

	// ── Keywords ─────────────────────────────────────────
	let kwInput = $state('');
	let kwCountry = $state('uk');
	let kwLoading = $state(false);
	let kwData = $state<any>(null);
	let kwError = $state('');

	async function searchKeywords() {
		if (!kwInput.trim()) return;
		kwError = ''; kwLoading = true; kwData = null;
		try {
			kwData = await api.keywordResearch(kwInput.trim());
		} catch (err) {
			kwError = err instanceof Error ? err.message : 'Search failed.';
		}
		kwLoading = false;
	}

	// ── Backlinks ────────────────────────────────────────
	let blInput = $state('');
	let blLoading = $state(false);
	let blData = $state<any>(null);
	let blError = $state('');
	let linkHealthLoading = $state(false);
	let linkHealthData = $state<any>(null);

	async function searchBacklinks() {
		if (!blInput.trim()) return;
		blError = ''; blLoading = true; blData = null; linkHealthData = null;
		try {
			// Run backlink estimate + outbound link health in parallel
			const domain = blInput.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
			const [backlinks, crawl] = await Promise.allSettled([
				api.getBacklinks(domain),
				fetchLinkHealth(domain)
			]);
			if (backlinks.status === 'fulfilled') blData = backlinks.value;
			if (crawl.status === 'fulfilled') linkHealthData = crawl.value;
		} catch (err) {
			blError = err instanceof Error ? err.message : 'Analysis failed.';
		}
		blLoading = false;
	}

	async function fetchLinkHealth(domain: string) {
		const token = safeGetStorage('bscan_token');
		if (!token) return null;
		const url = domain.includes('://') ? domain : `https://${domain}`;
		const res = await fetch('https://api-bscan.balancewises.io/api/crawl/deep', {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ url, max_pages: 1 })
		});
		if (!res.ok) return null;
		return res.json();
	}

	// ── SEO History ──────────────────────────────────────
	let seoHistory = $state<any[]>([]);
	let histLoading = $state(false);

	async function loadSeoHistory() {
		histLoading = true;
		try {
			const res = await api.getSeoHistory();
			seoHistory = res.items || res || [];
		} catch { seoHistory = []; }
		histLoading = false;
	}

	function kwKeydown(e: KeyboardEvent) { if (e.key === 'Enter') searchKeywords(); }
	function blKeydown(e: KeyboardEvent) { if (e.key === 'Enter') searchBacklinks(); }

	// ── GSC State ────────────────────────────────────────
	let gscConnected = $state(false);
	let gscSites = $state<any[]>([]);
	let gscSelectedSite = $state('');
	let gscSitesLoading = $state(false);
	let gscOverview = $state<any>(null);
	let gscOverviewLoading = $state(false);
	let gscDisconnecting = $state(false);
	let showDisconnectModal = $state(false);

	async function connectGSC() {
		gscLoading = true;
		gscError = '';
		try {
			const token = safeGetStorage('bscan_token');
			if (!token) { gscError = 'Please sign in first.'; gscLoading = false; return; }
			const res = await fetch('https://api-bscan.balancewises.io/api/seo/gsc/connect', {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const d = await res.json();
			const safe = safeRedirect(d.auth_url);
			if (safe) window.location.href = safe;
			else gscError = 'Could not connect — invalid redirect URL.';
		} catch {
			gscError = 'Connection failed. Please try again.';
		}
		gscLoading = false;
	}

	async function checkGscStatus() {
		try {
			const status = await api.gscStatus();
			gscConnected = status.connected;
			if (gscConnected) {
				await loadGscSites();
			}
		} catch {
			gscConnected = false;
		}
	}

	async function loadGscSites() {
		gscSitesLoading = true;
		try {
			const res = await api.gscSites();
			gscSites = res.sites || [];
			if (gscSites.length > 0 && !gscSelectedSite) {
				gscSelectedSite = gscSites[0].site_url;
				await loadGscOverview();
			}
		} catch (err) {
			gscError = 'Failed to load sites. Your token may have expired — try reconnecting.';
			gscSites = [];
		}
		gscSitesLoading = false;
	}

	async function loadGscOverview() {
		if (!gscSelectedSite) return;
		gscOverviewLoading = true;
		gscOverview = null;
		try {
			gscOverview = await api.gscOverview(gscSelectedSite);
		} catch (err) {
			gscError = err instanceof Error ? err.message : 'Failed to load GSC data.';
		}
		gscOverviewLoading = false;
	}

	async function disconnectGSC() {
		gscDisconnecting = true;
		showDisconnectModal = false;
		try {
			await api.gscDisconnect();
			gscConnected = false;
			gscSites = [];
			gscSelectedSite = '';
			gscOverview = null;
			gscSuccess = '';
		} catch {
			gscError = 'Failed to disconnect.';
		}
		gscDisconnecting = false;
	}

	function posColor(pos: number): string {
		if (pos <= 3) return 'var(--clr-success)';
		if (pos <= 10) return 'var(--clr-blue)';
		if (pos <= 20) return 'var(--clr-warning)';
		return 'var(--clr-danger)';
	}

	let gscChecked = $state(false);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('gsc') === 'connected') {
			activeTab = 'gsc';
			gscSuccess = 'Google Search Console connected successfully!';
			window.history.replaceState({}, '', '/seo');
		}
		if (params.get('gsc_error')) {
			activeTab = 'gsc';
			gscError = `Connection failed: ${params.get('gsc_error')}`;
			window.history.replaceState({}, '', '/seo');
		}
	});

	// Watch for auth to finish loading, then check GSC status
	$effect(() => {
		if ($auth.user && !gscChecked) {
			gscChecked = true;
			checkGscStatus();
		}
	});
</script>

<Seo
	title="SEO Dashboard — Free Keyword Research & Backlink Analysis"
	description="Free keyword research, backlink analysis, Google Search Console integration, and AI-powered SEO strategy tools. Powered by BSCAN."
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "BSCAN SEO Dashboard",
		"url": "https://bscan.balancewises.io/seo",
		"applicationCategory": "SEO Tool",
		"description": "Free keyword research tool with Google Autocomplete data, backlink analysis, and Google Search Console integration.",
		"operatingSystem": "All",
		"offers": { "@type": "Offer", "price": "0.00", "priceCurrency": "GBP", "description": "Free keyword research and backlink analysis" }
	}}
/>

<div class="container" style="max-width: 960px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-gold"><BarChart3 size={14} strokeWidth={2} /> SEO</span>
		<h1>SEO <span class="text-gold">Dashboard</span></h1>
		<p class="text-secondary">Keyword research, backlink analysis, and SEO intelligence tools.</p>
	</div>

	{#if !isLoggedIn}
		<div class="card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 48px;">
				<div style="font-size: 32px; margin-bottom: 12px;">🔐</div>
				<h3>Sign in to access SEO tools</h3>
				<p class="text-secondary" style="margin: 8px 0 20px;">Free accounts get keyword research. Pro unlocks backlinks.</p>
				<a href="/account" class="btn btn-gold">Sign In / Create Account</a>
			</div>
		</div>
	{:else}
		<!-- Tabs -->
		<div class="tabs-row animate-fade-up">
			<button class="seo-tab" class:active={activeTab === 'keywords'} onclick={() => activeTab = 'keywords'}><Search size={14} strokeWidth={2} /> Keywords</button>
			<button class="seo-tab" class:active={activeTab === 'backlinks'} onclick={() => activeTab = 'backlinks'}><Link2 size={14} strokeWidth={2} /> Backlinks</button>
			<button class="seo-tab" class:active={activeTab === 'gsc'} onclick={() => { activeTab = 'gsc'; if (!gscConnected && $auth.user) checkGscStatus(); }}><TrendingUp size={14} strokeWidth={2} /> Search Console {#if gscConnected}<span class="gsc-dot"></span>{/if}</button>
			<button class="seo-tab" class:active={activeTab === 'history'} onclick={() => { activeTab = 'history'; loadSeoHistory(); }}><ClipboardList size={14} strokeWidth={2} /> History</button>
		</div>

		<!-- ════ KEYWORDS ════ -->
		{#if activeTab === 'keywords'}
			<div class="tab-panel animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span><Search size={14} strokeWidth={2} /></span>
						<span style="font-weight: 700;">Keyword Research</span>
						<span class="badge badge-gold" style="margin-left: auto;">Free</span>
					</div>
					<div class="card-body">
						<div class="search-row">
							<input class="input" type="text" placeholder="Enter a keyword or topic..." bind:value={kwInput} onkeydown={kwKeydown} style="flex: 1;" />
							<select class="input" bind:value={kwCountry} style="width: 80px; flex: none;">
								<option value="uk">UK</option>
								<option value="us">US</option>
								<option value="de">DE</option>
								<option value="fr">FR</option>
							</select>
							<button class="btn btn-gold" disabled={kwLoading} onclick={searchKeywords}>
								{#if kwLoading}<span class="spinner spinner-sm"></span>{:else}Search{/if}
							</button>
						</div>
						{#if kwError}<div class="msg-error">{kwError}</div>{/if}
					</div>
				</div>

				{#if kwLoading}
					<div style="margin-top: 16px;"><Skeleton lines={5} /></div>
				{/if}

				{#if kwData}
					<div class="kw-results">
						<!-- Seed info -->
						<div class="kw-seed">
							<span class="font-mono">Seed: {sanitize(kwData.seed_keyword)}</span>
							<span class="text-muted">· {kwData.total_keywords || 0} keywords found</span>
						</div>

						<!-- Direct Suggestions -->
						{#if kwData.suggestions?.length}
							<div class="kw-section">
								<div class="kw-section-title">💡 Direct Suggestions ({kwData.suggestions.length})</div>
								<div class="kw-tags">
									{#each kwData.suggestions as kw}
										<span class="kw-tag">{sanitize(kw)}</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Questions -->
						{#if kwData.questions?.length}
							<div class="kw-section">
								<div class="kw-section-title">❓ Question Keywords ({kwData.questions.length})</div>
								<div class="kw-list">
									{#each kwData.questions.slice(0, 20) as q}
										<div class="kw-list-item">{sanitize(q)}</div>
									{/each}
									{#if kwData.questions.length > 20}
										<div class="kw-more text-muted">+ {kwData.questions.length - 20} more</div>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Prepositions -->
						{#if kwData.prepositions?.length}
							<div class="kw-section">
								<div class="kw-section-title"><Link2 size={14} strokeWidth={2} style="display:inline" /> Preposition Variations ({kwData.prepositions.length})</div>
								<div class="kw-tags">
									{#each kwData.prepositions.slice(0, 30) as p}
										<span class="kw-tag">{sanitize(p)}</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Comparisons -->
						{#if kwData.comparisons?.length}
							<div class="kw-section">
								<div class="kw-section-title"><Scale size={14} strokeWidth={2} style="display:inline" /> Comparison Keywords ({kwData.comparisons.length})</div>
								<div class="kw-tags">
									{#each kwData.comparisons.slice(0, 20) as c}
										<span class="kw-tag">{sanitize(c)}</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Long Tail -->
						{#if kwData.long_tail?.length}
							<div class="kw-section">
								<div class="kw-section-title"><Target size={14} strokeWidth={2} style="display:inline" /> Long-Tail Ideas ({kwData.long_tail.length})</div>
								<div class="kw-tags">
									{#each kwData.long_tail.slice(0, 30) as lt}
										<span class="kw-tag subtle">{sanitize(lt)}</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Alphabetical Expansions -->
						{#if kwData.alphabet_expansions && Object.keys(kwData.alphabet_expansions).length > 0}
							<div class="kw-section">
								<div class="kw-section-title">🔤 A-Z Expansions</div>
								<div class="alpha-grid">
									{#each Object.entries(kwData.alphabet_expansions) as [letter, words]}
										{#if Array.isArray(words) && words.length > 0}
											<div class="alpha-group">
												<div class="alpha-letter">{letter.toUpperCase()}</div>
												{#each (words as string[]).slice(0, 5) as w}
													<div class="alpha-word">{sanitize(w)}</div>
												{/each}
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- ════ BACKLINKS ════ -->
		{#if activeTab === 'backlinks'}
			<div class="tab-panel animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span><Link2 size={14} strokeWidth={2} /></span>
						<span style="font-weight: 700;">Link Intelligence</span>
						{#if !isPaid}<span class="badge badge-blue" style="margin-left: auto;">Pro</span>{/if}
					</div>
					<div class="card-body">
						{#if isPaid}
							<p class="text-secondary" style="font-size: 12px; margin-bottom: 12px;">Analyse any domain's backlink profile and outbound link health in one scan.</p>
							<div class="search-row">
								<input class="input" type="text" placeholder="Enter domain (e.g. example.com)" bind:value={blInput} onkeydown={blKeydown} style="flex: 1;" />
								<button class="btn btn-blue" disabled={blLoading} onclick={searchBacklinks}>
									{#if blLoading}<span class="spinner spinner-sm"></span>{:else}Analyse{/if}
								</button>
							</div>
							{#if blError}<div class="msg-error">{blError}</div>{/if}
						{:else}
							<div class="upgrade-gate">
								<div style="margin-bottom: 12px;"><Link2 size={28} strokeWidth={1.5} /></div>
								<h3>Link Intelligence</h3>
								<p class="text-secondary" style="max-width: 420px; margin: 0 auto; line-height: 1.6;">Outbound link health analysis, dofollow/nofollow detection, backlink estimates, AI-powered recommendations, and Google Search Console integration.</p>
								<a href="/#pricing" class="btn btn-gold" style="margin-top: 16px;">Upgrade to Pro — £9/mo</a>
								<div style="margin-top: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
									<span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); color: var(--clr-text-muted);">Dofollow / Nofollow detection</span>
									<span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); color: var(--clr-text-muted);">Outbound link audit</span>
									<span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); color: var(--clr-text-muted);">Backlink estimates</span>
									<span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); color: var(--clr-text-muted);">AI recommendations</span>
									<span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); color: var(--clr-text-muted);">GSC integration</span>
								</div>
							</div>
						{/if}
					</div>
				</div>

				{#if blLoading}
					<div style="margin-top: 16px;"><Skeleton lines={6} /></div>
				{/if}

				{#if blData || linkHealthData}
					<!-- ── Section 1: Outbound Link Health (from deep crawl) ── -->
					{#if linkHealthData?.summary?.link_analysis}
						{@const la = linkHealthData.summary.link_analysis}
						<div class="card animate-fade-up" style="margin-top: 16px;">
							<div class="card-header">
								<span><Link2 size={14} strokeWidth={2} /></span>
								<span style="font-weight: 700; font-size: 13px;">Outbound Link Health</span>
								<span class="badge badge-blue" style="margin-left: auto;">Live Scan</span>
							</div>
							<div class="card-body" style="padding: 0;">
								<!-- Link stats grid -->
								<div class="bl-stats-grid" style="padding: 16px;">
									<div class="bl-stat">
										<div class="bl-stat-label">Total Links</div>
										<div class="bl-stat-value">{la.total_links}</div>
									</div>
									<div class="bl-stat">
										<div class="bl-stat-label">Internal</div>
										<div class="bl-stat-value" style="color: var(--clr-blue);">{la.internal_links}</div>
									</div>
									<div class="bl-stat">
										<div class="bl-stat-label">External</div>
										<div class="bl-stat-value" style="color: var(--clr-warning);">{la.external_links}</div>
									</div>
									<div class="bl-stat">
										<div class="bl-stat-label">Empty Anchors</div>
										<div class="bl-stat-value" style="color: {la.broken_anchors > 10 ? 'var(--clr-text-muted)' : la.broken_anchors > 0 ? 'var(--clr-warning)' : 'var(--clr-success)'};">{la.broken_anchors}</div>
									</div>
								</div>

								<!-- Dofollow / Nofollow bar -->
								<div style="padding: 0 16px 16px;">
									<div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
										<span class="text-muted font-mono">Dofollow {la.dofollow_pct}%</span>
										<span class="text-muted font-mono">Nofollow {la.nofollow_pct}%</span>
									</div>
									<div style="height: 8px; border-radius: 4px; background: var(--clr-bg-primary); overflow: hidden; display: flex;">
										<div style="width: {la.dofollow_pct}%; background: var(--clr-success); transition: width 0.5s;"></div>
										<div style="width: {la.nofollow_pct}%; background: var(--clr-warning); transition: width 0.5s;"></div>
									</div>

									<!-- Link attribute breakdown -->
									<div style="display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap;">
										<div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
											<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--clr-success); display: inline-block;"></span>
											<span class="text-muted">Dofollow: {la.dofollow}</span>
										</div>
										<div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
											<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--clr-warning); display: inline-block;"></span>
											<span class="text-muted">Nofollow: {la.nofollow}</span>
										</div>
										{#if la.sponsored > 0}
											<div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
												<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--clr-blue); display: inline-block;"></span>
												<span class="text-muted">Sponsored: {la.sponsored}</span>
											</div>
										{/if}
										{#if la.ugc > 0}
											<div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
												<span style="width: 8px; height: 8px; border-radius: 50%; background: #a78bfa; display: inline-block;"></span>
												<span class="text-muted">UGC: {la.ugc}</span>
											</div>
										{/if}
									</div>
								</div>

								<!-- AI-style insight -->
								{#if la.total_links > 0}
									<div style="padding: 12px 16px; border-top: 1px solid var(--clr-border); background: rgba(59,130,246,0.04);">
										<div style="font-size: 12px; color: var(--clr-text-secondary); line-height: 1.6;">
											{#if la.nofollow_pct === 0 && la.external_links > 0}
												<strong style="color: var(--clr-warning);">Heads up:</strong> All {la.external_links} external links are dofollow — you're passing link equity to every external site. Consider adding <code style="font-size: 11px; padding: 1px 4px; background: var(--clr-bg-primary); border-radius: 3px;">rel="nofollow"</code> to affiliate, ad, or untrusted links.
											{:else if la.nofollow_pct > 0 && la.nofollow_pct < 20}
												<strong style="color: var(--clr-success);">Healthy mix:</strong> {la.dofollow_pct}% dofollow / {la.nofollow_pct}% nofollow is a natural link profile. External links are well-managed.
											{:else if la.nofollow_pct >= 50}
												<strong style="color: var(--clr-blue);">Conservative approach:</strong> Over half your links are nofollow. If some are trusted editorial links, switching them to dofollow could help those pages rank better.
											{:else if la.external_links === 0}
												<strong style="color: var(--clr-text-muted);">No external links found.</strong> Adding relevant outbound links to authoritative sources can actually improve your SEO — Google values pages that reference quality content.
											{:else}
												<strong style="color: var(--clr-success);">Good balance.</strong> Your dofollow/nofollow ratio looks healthy at {la.dofollow_pct}%/{la.nofollow_pct}%.
											{/if}
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Per-page breakdown -->
						{#if linkHealthData.pages?.length > 0}
							<div class="card animate-fade-up" style="margin-top: 12px;">
								<div class="card-header">
									<span><ClipboardList size={14} strokeWidth={2} /></span>
									<span style="font-weight: 700; font-size: 13px;">Page Breakdown</span>
								</div>
								<div class="card-body" style="padding: 0;">
									{#each linkHealthData.pages as pg}
										{@const pla = pg.link_analysis || {}}
										<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--clr-border); font-size: 12px;">
											<span class="font-mono" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--clr-text-secondary);">{pg.url?.replace('https://', '').replace('http://', '') || '—'}</span>
											<div style="display: flex; gap: 12px; flex-shrink: 0; margin-left: 12px;">
												<span class="text-muted">{pla.total_links || 0} links</span>
												<span style="color: var(--clr-success); font-weight: 600;">{pla.dofollow || 0} df</span>
												<span style="color: var(--clr-warning); font-weight: 600;">{pla.nofollow || 0} nf</span>
												<span style="color: var(--clr-text-muted);">{pla.external_links || 0} ext</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}

					<!-- ── Section 2: SEO Recommendations ── -->
					{#if linkHealthData?.summary?.link_analysis}
						{@const r = linkHealthData.summary.link_analysis}
						<div class="card animate-fade-up" style="margin-top: 16px;">
							<div class="card-header">
								<span><Target size={14} strokeWidth={2} /></span>
								<span style="font-weight: 700; font-size: 13px;">SEO Recommendations</span>
								<span class="badge badge-gold" style="margin-left: auto;">AI</span>
							</div>
							<div class="card-body" style="padding: 0;">
								<!-- Dofollow/Nofollow recommendation -->
								{#if r.nofollow_pct === 0 && r.external_links > 0}
									<div class="rec-item rec-warning">
										<div class="rec-severity">Fix</div>
										<div class="rec-content">
											<div class="rec-title">Add nofollow to untrusted external links</div>
											<div class="rec-detail">All {r.external_links} external links pass link equity (dofollow). Add <code>rel="nofollow"</code> to affiliate, ad, or user-submitted links to protect your domain authority.</div>
										</div>
									</div>
								{:else if r.nofollow_pct > 0 && r.nofollow_pct <= 30}
									<div class="rec-item rec-pass">
										<div class="rec-severity">Good</div>
										<div class="rec-content">
											<div class="rec-title">Healthy dofollow/nofollow balance</div>
											<div class="rec-detail">{r.dofollow_pct}% dofollow / {r.nofollow_pct}% nofollow is a natural link profile. Search engines see this as organic.</div>
										</div>
									</div>
								{:else if r.nofollow_pct > 50}
									<div class="rec-item rec-info">
										<div class="rec-severity">Tip</div>
										<div class="rec-content">
											<div class="rec-title">Consider switching trusted links to dofollow</div>
											<div class="rec-detail">Over {r.nofollow_pct}% of your links are nofollow. If some point to trusted editorial sources, making them dofollow can strengthen your content's authority signals.</div>
										</div>
									</div>
								{/if}

								<!-- External link ratio -->
								{#if r.external_pct > 40}
									<div class="rec-item rec-warning">
										<div class="rec-severity">Fix</div>
										<div class="rec-content">
											<div class="rec-title">High external link ratio ({r.external_pct}%)</div>
											<div class="rec-detail">Over 40% of your links point to other sites. Add more internal links to keep users on your site and distribute page authority across your pages.</div>
										</div>
									</div>
								{:else if r.external_pct > 0}
									<div class="rec-item rec-pass">
										<div class="rec-severity">Good</div>
										<div class="rec-content">
											<div class="rec-title">Balanced internal/external links</div>
											<div class="rec-detail">{r.internal_links} internal vs {r.external_links} external links ({r.external_pct}% external). Internal linking is strong.</div>
										</div>
									</div>
								{:else}
									<div class="rec-item rec-info">
										<div class="rec-severity">Tip</div>
										<div class="rec-content">
											<div class="rec-title">Add external links to authoritative sources</div>
											<div class="rec-detail">Pages with zero outbound links can look thin to search engines. Link to relevant, high-quality sources to add topical context.</div>
										</div>
									</div>
								{/if}

								<!-- Empty anchors -->
								{#if r.broken_anchors > 10}
									<div class="rec-item rec-info">
										<div class="rec-severity">Info</div>
										<div class="rec-content">
											<div class="rec-title">{r.broken_anchors} empty anchor tags found (href="#")</div>
											<div class="rec-detail">These are links with <code>href="#"</code> or empty href — used for interactive UI elements like dropdowns, tabs, and selectors. Not broken links, but search engines can't follow them.</div>
											{#if r.broken_anchor_samples?.length > 0}
												<div style="margin-top: 8px; padding: 8px 10px; background: var(--clr-bg-deep); border-radius: var(--radius-sm); border: 1px solid var(--clr-border);">
													<div style="font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); margin-bottom: 6px;">SAMPLES:</div>
													{#each r.broken_anchor_samples.slice(0, 5) as sample}
														<div style="font-size: 11px; color: var(--clr-text-secondary); padding: 2px 0; font-family: var(--font-mono);">
															<span style="color: var(--clr-text-muted);">href="{sample.href}"</span> &rarr; <span style="color: var(--clr-text-primary);">"{sample.text?.split('\n')[0]?.trim()}"</span>
														</div>
													{/each}
													{#if r.broken_anchor_samples.length > 5}
														<div style="font-size: 10px; color: var(--clr-text-muted); margin-top: 4px;">+ {r.broken_anchors - 5} more</div>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								{:else if r.broken_anchors > 0}
									<div class="rec-item rec-warning">
										<div class="rec-severity">Fix</div>
										<div class="rec-content">
											<div class="rec-title">{r.broken_anchors} empty anchor tag{r.broken_anchors > 1 ? 's' : ''}</div>
											<div class="rec-detail">Links with empty or # hrefs don't help navigation or SEO. Replace with real URLs or remove them.</div>
											{#if r.broken_anchor_samples?.length > 0}
												<div style="margin-top: 8px; padding: 8px 10px; background: var(--clr-bg-deep); border-radius: var(--radius-sm); border: 1px solid var(--clr-border);">
													{#each r.broken_anchor_samples as sample}
														<div style="font-size: 11px; color: var(--clr-text-secondary); padding: 2px 0; font-family: var(--font-mono);">
															<span style="color: var(--clr-text-muted);">href="{sample.href}"</span> &rarr; <span style="color: var(--clr-text-primary);">"{sample.text?.split('\n')[0]?.trim()}"</span>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									</div>
								{:else}
									<div class="rec-item rec-pass">
										<div class="rec-severity">Good</div>
										<div class="rec-content">
											<div class="rec-title">No empty anchors detected</div>
											<div class="rec-detail">All link elements have valid destinations.</div>
										</div>
									</div>
								{/if}

								<!-- Sponsored/UGC -->
								{#if r.sponsored > 0 || r.ugc > 0}
									<div class="rec-item rec-pass">
										<div class="rec-severity">Good</div>
										<div class="rec-content">
											<div class="rec-title">Proper use of link attributes</div>
											<div class="rec-detail">
												{#if r.sponsored > 0}{r.sponsored} sponsored link{r.sponsored > 1 ? 's' : ''} correctly marked. {/if}
												{#if r.ugc > 0}{r.ugc} user-generated content link{r.ugc > 1 ? 's' : ''} correctly marked.{/if}
												Google rewards sites that properly classify their links.
											</div>
										</div>
									</div>
								{/if}

								<!-- Link volume -->
								{#if r.total_links < 5}
									<div class="rec-item rec-warning">
										<div class="rec-severity">Fix</div>
										<div class="rec-content">
											<div class="rec-title">Very few links on page ({r.total_links})</div>
											<div class="rec-detail">Pages with too few links may signal thin content. Add relevant internal links to related pages and external links to authoritative sources.</div>
										</div>
									</div>
								{:else if r.total_links > 200}
									<div class="rec-item rec-info">
										<div class="rec-severity">Tip</div>
										<div class="rec-content">
											<div class="rec-title">High link count ({r.total_links})</div>
											<div class="rec-detail">Google recommends keeping links reasonable per page. Consider consolidating navigation or using pagination to reduce link bloat.</div>
										</div>
									</div>
								{/if}

								<!-- Link signals from basic analysis -->
								{#if blData?.link_signals?.length > 0}
									{#each blData.link_signals as signal}
										<div class="rec-item rec-pass">
											<div class="rec-severity">Good</div>
											<div class="rec-content">
												<div class="rec-title">{sanitize(signal)}</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					{/if}

					<!-- ── Section 3: GSC Prompt (if not connected) ── -->
					{#if !gscConnected}
						<div class="card animate-fade-up" style="margin-top: 16px; border: 1px solid rgba(59,130,246,0.2);">
							<div class="card-body" style="text-align: center; padding: 24px;">
								<TrendingUp size={24} strokeWidth={1.5} style="color: var(--clr-blue); margin-bottom: 8px;" />
								<h3 style="font-size: 15px; margin-bottom: 6px;">Want real backlink data?</h3>
								<p class="text-secondary" style="font-size: 12px; max-width: 380px; margin: 0 auto 16px; line-height: 1.5;">
									Google Search Console shows the actual links Google has found pointing to your site — completely free. Connect in 30 seconds.
								</p>
								<button class="btn btn-blue btn-sm" onclick={() => { activeTab = 'gsc'; }}>
									Connect Search Console
								</button>
							</div>
						</div>
					{:else}
						<div class="card animate-fade-up" style="margin-top: 16px; border: 1px solid rgba(16,185,129,0.2);">
							<div class="card-body" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px;">
								<div style="display: flex; align-items: center; gap: 8px;">
									<span class="gsc-connected-badge">✓ GSC Connected</span>
									<span class="text-muted" style="font-size: 11px;">Real ranking data available</span>
								</div>
								<button class="btn btn-blue btn-sm" onclick={() => { activeTab = 'gsc'; }}>
									View GSC Data
								</button>
							</div>
						</div>
					{/if}

					<!-- ── Section 4: Deep Crawl CTA ── -->
					{#if !linkHealthData && isPaid}
						<div class="card animate-fade-up" style="margin-top: 16px;">
							<div class="card-body" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px;">
								<div>
									<div style="font-size: 13px; font-weight: 600;">Full Site Link Audit</div>
									<div class="text-muted" style="font-size: 11px;">Crawl up to 25 pages for complete nofollow/dofollow analysis</div>
								</div>
								<a href="/deep-crawl" class="btn btn-gold btn-sm">Deep Crawl</a>
							</div>
						</div>
					{/if}
				{/if}

				<!-- Empty state before search (Pro users only) -->
				{#if isPaid && !blData && !linkHealthData && !blLoading}
					<div style="margin-top: 24px; text-align: center; padding: 32px 16px;">
						<Link2 size={32} strokeWidth={1.2} style="color: var(--clr-text-muted); margin-bottom: 12px;" />
						<p class="text-secondary" style="font-size: 13px; max-width: 400px; margin: 0 auto;">Enter a domain above to scan its outbound link health, detect dofollow/nofollow attributes, and estimate inbound backlinks.</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ════ SEARCH CONSOLE ════ -->
		{#if activeTab === 'gsc'}
			<div class="tab-panel animate-fade-up">
				{#if gscSuccess}
					<div class="msg-success" style="margin-bottom: 16px;">{gscSuccess}</div>
				{/if}
				{#if gscError}
					<div class="msg-error" style="margin-bottom: 16px;">{gscError}
						<button class="btn-dismiss" onclick={() => gscError = ''}>✕</button>
					</div>
				{/if}

				{#if !gscConnected}
					<!-- Not connected -->
					<div class="card">
						<div class="card-header">
							<span><TrendingUp size={14} strokeWidth={2} /></span>
							<span style="font-weight: 700;">Google Search Console</span>
							<span class="badge badge-gold" style="margin-left: auto;">Free</span>
						</div>
						<div class="card-body" style="text-align: center; padding: 32px;">
							<div style="font-size: 28px; margin-bottom: 8px;"><TrendingUp size={28} strokeWidth={1.5} /></div>
							<h3>Connect Google Search Console</h3>
							<p class="text-secondary" style="max-width: 400px; margin: 8px auto 20px; line-height: 1.6;">
								Link your GSC account to see real keyword rankings, click data, impressions, and average position directly in BSCAN.
							</p>
							<button class="btn btn-blue" disabled={gscLoading} onclick={connectGSC}>
								{#if gscLoading}<span class="spinner spinner-sm"></span>{:else}Connect Google Search Console{/if}
							</button>
							<p class="text-muted" style="margin-top: 16px; font-size: 11px; max-width: 360px; margin-left: auto; margin-right: auto;">
								Make sure you connect with the Google account that owns your Search Console properties.
							</p>
						</div>
					</div>
				{:else}
					<!-- Connected — Site Selector + Data -->
					<div class="card" style="margin-bottom: 16px;">
						<div class="card-header">
							<span><TrendingUp size={14} strokeWidth={2} /></span>
							<span style="font-weight: 700;">Google Search Console</span>
							<div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
								<span class="gsc-connected-badge">✓ Connected</span>
								<button class="btn-text-danger" disabled={gscDisconnecting} onclick={() => showDisconnectModal = true}>
									{#if gscDisconnecting}...{:else}Disconnect{/if}
								</button>
							</div>
						</div>
						<div class="card-body">
							{#if gscSitesLoading}
								<Skeleton lines={2} />
							{:else if gscSites.length === 0}
								<div style="text-align: center; padding: 20px;">
									<p class="text-muted" style="margin-bottom: 12px;">No verified sites found. Make sure the Google account you connected owns verified properties in <a href="https://search.google.com/search-console" target="_blank" rel="noopener" style="color: var(--clr-blue);">Search Console</a>.</p>
									<button class="btn btn-blue btn-sm" onclick={connectGSC}>Reconnect with different account</button>
								</div>
							{:else}
								<div class="gsc-site-row">
									<label class="text-muted" style="font-size: 11px; font-weight: 600;">SITE</label>
									<select class="input" bind:value={gscSelectedSite} onchange={loadGscOverview} style="flex: 1;">
										{#each gscSites as site}
											<option value={site.site_url}>{site.site_url}</option>
										{/each}
									</select>
									<button class="btn btn-blue btn-sm" disabled={gscOverviewLoading} onclick={loadGscOverview}>
										{#if gscOverviewLoading}<span class="spinner spinner-sm"></span>{:else}Refresh{/if}
									</button>
								</div>
							{/if}
						</div>
					</div>

					{#if gscOverviewLoading}
						<Skeleton lines={6} />
					{/if}

					{#if gscOverview}
						<!-- Summary Stats -->
						{#if gscOverview.summary && Object.keys(gscOverview.summary).length > 0}
							<div class="gsc-stats-grid animate-fade-up">
								<div class="gsc-stat">
									<div class="gsc-stat-label">Total Clicks</div>
									<div class="gsc-stat-value">{gscOverview.summary.total_clicks?.toLocaleString() ?? '—'}</div>
								</div>
								<div class="gsc-stat">
									<div class="gsc-stat-label">Impressions</div>
									<div class="gsc-stat-value">{gscOverview.summary.total_impressions?.toLocaleString() ?? '—'}</div>
								</div>
								<div class="gsc-stat">
									<div class="gsc-stat-label">Avg Position</div>
									<div class="gsc-stat-value">{gscOverview.summary.average_position ?? '—'}</div>
								</div>
								<div class="gsc-stat">
									<div class="gsc-stat-label">Avg CTR</div>
									<div class="gsc-stat-value">{gscOverview.summary.average_ctr ?? '—'}%</div>
								</div>
								<div class="gsc-stat">
									<div class="gsc-stat-label">Keywords</div>
									<div class="gsc-stat-value">{gscOverview.summary.total_keywords ?? '—'}</div>
								</div>
							</div>
						{/if}

						<!-- Position Distribution -->
						{#if gscOverview.position_distribution && Object.keys(gscOverview.position_distribution).length > 0}
							<div class="card animate-fade-up" style="margin-bottom: 16px;">
								<div class="card-header">
									<span><BarChart3 size={14} strokeWidth={2} /></span>
									<span style="font-weight: 700; font-size: 13px;">Position Distribution</span>
								</div>
								<div class="card-body">
									<div class="pos-dist-row">
										{#each Object.entries(gscOverview.position_distribution) as [range, count]}
											<div class="pos-dist-item">
												<div class="pos-dist-bar" style="height: {Math.max(4, Math.min(60, (count as number) * 3))}px;"></div>
												<div class="pos-dist-count">{count}</div>
												<div class="pos-dist-label">{range}</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}

						<!-- Top Keywords -->
						{#if gscOverview.top_keywords?.length > 0}
							<div class="card animate-fade-up" style="margin-bottom: 16px;">
								<div class="card-header">
									<span><Search size={14} strokeWidth={2} /></span>
									<span style="font-weight: 700; font-size: 13px;">Top Keywords ({gscOverview.top_keywords.length})</span>
								</div>
								<div class="card-body" style="padding: 0;">
									<div class="gsc-table-header">
										<span class="gsc-th-kw">Keyword</span>
										<span class="gsc-th">Clicks</span>
										<span class="gsc-th">Impr.</span>
										<span class="gsc-th">CTR</span>
										<span class="gsc-th">Pos.</span>
									</div>
									{#each gscOverview.top_keywords.slice(0, 25) as kw}
										<div class="gsc-table-row">
											<span class="gsc-td-kw font-mono">{kw.keyword}</span>
											<span class="gsc-td">{kw.clicks}</span>
											<span class="gsc-td">{kw.impressions?.toLocaleString()}</span>
											<span class="gsc-td">{kw.ctr}%</span>
											<span class="gsc-td" style="color: {posColor(kw.position)}; font-weight: 700;">{kw.position}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Quick Win Opportunities -->
						{#if gscOverview.opportunities?.length > 0}
							<div class="card animate-fade-up" style="margin-bottom: 16px;">
								<div class="card-header">
									<span><Target size={14} strokeWidth={2} /></span>
									<span style="font-weight: 700; font-size: 13px;">Quick Win Opportunities</span>
								</div>
								<div class="card-body" style="padding: 0;">
									{#each gscOverview.opportunities.slice(0, 8) as opp}
										<div class="gsc-opp-row">
											<div>
												<div class="font-mono" style="font-size: 13px;">{opp.keyword}</div>
												<div class="text-muted" style="font-size: 11px; margin-top: 2px;">{opp.potential}</div>
											</div>
											<div style="text-align: right; flex-shrink: 0;">
												<div style="font-size: 18px; font-weight: 800; color: {posColor(opp.position)};">{opp.position}</div>
												<div class="text-muted" style="font-size: 10px;">{opp.impressions} impr.</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Top Pages -->
						{#if gscOverview.top_pages?.length > 0}
							<div class="card animate-fade-up" style="margin-bottom: 16px;">
								<div class="card-header">
									<span>📄</span>
									<span style="font-weight: 700; font-size: 13px;">Top Pages ({gscOverview.top_pages.length})</span>
								</div>
								<div class="card-body" style="padding: 0;">
									{#each gscOverview.top_pages.slice(0, 15) as pg}
										<div class="gsc-page-row">
											<span class="gsc-page-url font-mono">{pg.page?.replace('https://', '').replace('http://', '') || '—'}</span>
											<span class="gsc-page-clicks">{pg.clicks} clicks</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- No data state -->
						{#if (!gscOverview.top_keywords || gscOverview.top_keywords.length === 0) && (!gscOverview.top_pages || gscOverview.top_pages.length === 0)}
							<div class="card animate-fade-up">
								<div class="card-body" style="text-align: center; padding: 32px;">
									<div style="font-size: 28px; margin-bottom: 8px;"><Search size={28} strokeWidth={1.2} /></div>
									<h3>No data yet</h3>
									<p class="text-muted" style="max-width: 400px; margin: 8px auto;">This site doesn't have any Search Console data for the last 28 days. Make sure the site is verified and receiving traffic.</p>
								</div>
							</div>
						{/if}
					{/if}
				{/if}
			</div>
		{/if}

		<!-- ════ HISTORY ════ -->
		{#if activeTab === 'history'}
			<div class="tab-panel animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span><ClipboardList size={14} strokeWidth={2} /></span>
						<span style="font-weight: 700;">SEO Research History</span>
					</div>
					<div class="card-body">
						{#if histLoading}
							<Skeleton lines={4} />
						{:else if seoHistory.length === 0}
							<div style="text-align: center; padding: 32px;">
								<p class="text-muted">No SEO research history yet. Run a keyword search to get started.</p>
							</div>
						{:else}
							{#each seoHistory as item}
								<div class="hist-row">
									<div class="hist-type">{item.type === 'backlinks' ? 'BL' : 'KW'}</div>
									<div class="hist-query">{sanitize(item.query || item.keyword || item.domain || '')}</div>
									<div class="hist-date text-muted">{item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : ''}</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Disconnect Modal -->
{#if showDisconnectModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && (showDisconnectModal = false)} onkeydown={(e) => e.key === 'Escape' && (showDisconnectModal = false)}>
		<div class="modal-card">
			<div style="font-size: 28px; margin-bottom: 12px;">⚠️</div>
			<h3 style="margin-bottom: 8px;">Disconnect Search Console?</h3>
			<p class="text-muted" style="font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
				Your GSC data will be removed from BSCAN. You can reconnect at any time.
			</p>
			<div style="display: flex; gap: 10px; justify-content: center;">
				<button class="btn" style="background: var(--clr-bg-deep); color: var(--clr-text-secondary); border: 1px solid var(--clr-border);" onclick={() => showDisconnectModal = false}>Cancel</button>
				<button class="btn" style="background: var(--clr-danger); color: white; border: none;" onclick={disconnectGSC}>Disconnect</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page-header { text-align: center; margin-bottom: var(--space-xl); }
	.page-header h1 { font-style: italic; margin: 8px 0; }

	.tabs-row { display: flex; gap: 4px; margin-bottom: var(--space-md); background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 4px; overflow-x: auto; }
	.seo-tab { padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; background: transparent; color: var(--clr-text-secondary); transition: all var(--duration-fast); white-space: nowrap; }
	.seo-tab.active { background: var(--clr-blue); color: white; }

	.search-row { display: flex; gap: 8px; }
	.msg-error { padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-danger-dim); color: var(--clr-danger); font-size: 12px; position: relative; }
	.msg-success { padding: 10px 14px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 12px; font-weight: 600; }
	.btn-dismiss { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 4px; }
	.upgrade-gate { text-align: center; padding: var(--space-xl); }

	/* ── Keyword Results ──────────────── */
	.kw-results { margin-top: var(--space-md); }

	.kw-seed {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		font-size: 13px;
		margin-bottom: var(--space-md);
	}

	.kw-section {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
		margin-bottom: 12px;
	}

	.kw-section-title {
		font-size: 13px;
		font-weight: 700;
		margin-bottom: 10px;
	}

	.kw-tags { display: flex; flex-wrap: wrap; gap: 6px; }

	.kw-tag {
		padding: 5px 12px;
		border-radius: var(--radius-full);
		font-size: 12px;
		font-family: var(--font-mono);
		background: var(--clr-bg-primary);
		border: 1px solid var(--clr-border);
		color: var(--clr-text-secondary);
		cursor: default;
		transition: all var(--duration-fast);
	}

	.kw-tag:hover { border-color: var(--clr-border-light); color: var(--clr-text-primary); }
	.kw-tag.subtle { opacity: 0.7; }

	.kw-list { display: flex; flex-direction: column; }
	.kw-list-item { padding: 6px 0; font-size: 13px; color: var(--clr-text-secondary); border-bottom: 1px solid var(--clr-border); }
	.kw-list-item:last-child { border-bottom: none; }
	.kw-more { padding: 8px 0; font-size: 11px; }

	.alpha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
	.alpha-group { padding: 10px; background: var(--clr-bg-primary); border-radius: var(--radius-md); border: 1px solid var(--clr-border); }
	.alpha-letter { font-size: 16px; font-weight: 800; color: var(--clr-gold); margin-bottom: 6px; font-family: var(--font-mono); }
	.alpha-word { font-size: 11px; color: var(--clr-text-secondary); padding: 2px 0; }

	/* ── Backlink Results ─────────────── */
	.bl-results { margin-top: var(--space-md); }

	.bl-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: var(--space-md); }
	.bl-stat { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: var(--space-md); text-align: center; }
	.bl-stat-label { font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
	.bl-stat-value { font-size: 22px; font-weight: 800; }

	.bl-quality { padding: 10px 16px; border-radius: var(--radius-md); font-size: 13px; text-align: center; margin-bottom: var(--space-md); background: var(--clr-bg-card); border: 1px solid var(--clr-border); }
	.quality-good { border-color: rgba(16,185,129,0.3); color: var(--clr-success); }
	.quality-bad { border-color: rgba(239,68,68,0.3); color: var(--clr-danger); }

	.bl-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--clr-border); font-size: 13px; }
	.bl-row:last-child { border-bottom: none; }
	.bl-anchor, .bl-domain { color: var(--clr-text-secondary); }
	.bl-count { font-size: 11px; color: var(--clr-text-muted); }
	.bl-source { font-size: 10px; margin-top: var(--space-md); text-align: right; }

	/* ── History ──────────────────────── */
	.hist-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--clr-border); }
	.hist-row:last-child { border-bottom: none; }
	.hist-type { font-size: 16px; }
	.hist-query { flex: 1; font-size: 13px; font-family: var(--font-mono); }
	.hist-date { font-size: 11px; }

	/* ── GSC Connected State ─────────── */
	.gsc-dot { width: 6px; height: 6px; background: var(--clr-success); border-radius: 50%; display: inline-block; margin-left: 4px; vertical-align: middle; }
	.gsc-connected-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; color: var(--clr-success); background: rgba(16,185,129,0.1); border-radius: var(--radius-full); }
	.btn-text-danger { background: none; border: none; color: var(--clr-danger); font-size: 11px; cursor: pointer; font-family: inherit; font-weight: 600; padding: 4px 8px; border-radius: 4px; transition: background 0.15s; }
	.btn-text-danger:hover { background: rgba(239,68,68,0.1); }

	.gsc-site-row { display: flex; align-items: center; gap: 10px; }
	.gsc-site-row label { flex-shrink: 0; }

	.gsc-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
	.gsc-stat { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px; text-align: center; }
	.gsc-stat-label { font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
	.gsc-stat-value { font-size: 22px; font-weight: 800; }

	/* Position distribution */
	.pos-dist-row { display: flex; justify-content: space-around; align-items: flex-end; gap: 8px; height: 80px; padding: 0 12px; }
	.pos-dist-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
	.pos-dist-bar { width: 32px; background: var(--clr-blue); border-radius: 4px 4px 0 0; transition: height 0.3s; }
	.pos-dist-count { font-size: 12px; font-weight: 700; }
	.pos-dist-label { font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); }

	/* GSC keyword table */
	.gsc-table-header { display: grid; grid-template-columns: 1fr 60px 70px 55px 50px; gap: 8px; padding: 8px 16px; font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; border-bottom: 1px solid var(--clr-border); }
	.gsc-table-row { display: grid; grid-template-columns: 1fr 60px 70px 55px 50px; gap: 8px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--clr-border); font-size: 12px; }
	.gsc-table-row:last-child { border-bottom: none; }
	.gsc-th { text-align: right; }
	.gsc-th-kw { text-align: left; }
	.gsc-td { text-align: right; color: var(--clr-text-secondary); }
	.gsc-td-kw { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--clr-text-primary); }

	/* GSC opportunities */
	.gsc-opp-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--clr-border); }
	.gsc-opp-row:last-child { border-bottom: none; }

	/* GSC pages */
	.gsc-page-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--clr-border); font-size: 12px; }
	.gsc-page-row:last-child { border-bottom: none; }
	.gsc-page-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--clr-text-secondary); }
	.gsc-page-clicks { flex-shrink: 0; font-weight: 700; color: var(--clr-blue); margin-left: 12px; }

	/* Disconnect modal */
	.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
	.modal-card { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 32px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }

	/* ── SEO Recommendations ──────────── */
	.rec-item { display: flex; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--clr-border); align-items: flex-start; }
	.rec-item:last-child { border-bottom: none; }
	.rec-severity { flex-shrink: 0; font-size: 10px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; padding: 3px 8px; border-radius: var(--radius-full); letter-spacing: 0.3px; margin-top: 1px; }
	.rec-warning .rec-severity { background: rgba(245,158,11,0.12); color: var(--clr-warning); }
	.rec-pass .rec-severity { background: rgba(16,185,129,0.12); color: var(--clr-success); }
	.rec-info .rec-severity { background: rgba(59,130,246,0.12); color: var(--clr-blue); }
	.rec-content { flex: 1; min-width: 0; }
	.rec-title { font-size: 13px; font-weight: 600; color: var(--clr-text-primary); margin-bottom: 3px; }
	.rec-detail { font-size: 12px; color: var(--clr-text-secondary); line-height: 1.5; }
	.rec-detail code { font-size: 11px; padding: 1px 5px; background: var(--clr-bg-primary); border-radius: 3px; border: 1px solid var(--clr-border); }

	@media (max-width: 640px) {
		.search-row { flex-direction: column; }
		.search-row select { width: 100% !important; }
		.alpha-grid { grid-template-columns: repeat(2, 1fr); }
		.gsc-table-header { display: none; }
		.gsc-table-row { grid-template-columns: 1fr 50px 50px; }
		.gsc-table-row .gsc-td:nth-child(3),
		.gsc-table-row .gsc-td:nth-child(4) { display: none; }
		.gsc-site-row { flex-direction: column; align-items: stretch; }
	}
</style>
