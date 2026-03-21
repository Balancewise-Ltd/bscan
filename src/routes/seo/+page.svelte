<script lang="ts">
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

	async function searchBacklinks() {
		if (!blInput.trim()) return;
		blError = ''; blLoading = true; blData = null;
		try {
			blData = await api.getBacklinks(blInput.trim());
		} catch (err) {
			blError = err instanceof Error ? err.message : 'Analysis failed.';
		}
		blLoading = false;
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
		if (!confirm('Disconnect Google Search Console? You can reconnect at any time.')) return;
		gscDisconnecting = true;
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

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('gsc') === 'connected') {
			activeTab = 'gsc';
			gscSuccess = 'Google Search Console connected successfully!';
			// Clean the URL
			window.history.replaceState({}, '', '/seo');
		}
		if (params.get('gsc_error')) {
			activeTab = 'gsc';
			gscError = `Connection failed: ${params.get('gsc_error')}`;
			window.history.replaceState({}, '', '/seo');
		}

		// Check GSC status if logged in
		if ($auth.user) {
			checkGscStatus();
		}
	});
</script>

<Seo title="SEO Dashboard" description="Free keyword research, backlink analysis, Google Search Console integration, and AI-powered SEO strategy tools. Powered by BSCAN." />

<div class="container" style="max-width: 960px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-gold">📊 SEO</span>
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
			<button class="seo-tab" class:active={activeTab === 'keywords'} onclick={() => activeTab = 'keywords'}>🔍 Keywords</button>
			<button class="seo-tab" class:active={activeTab === 'backlinks'} onclick={() => activeTab = 'backlinks'}>🔗 Backlinks</button>
			<button class="seo-tab" class:active={activeTab === 'gsc'} onclick={() => { activeTab = 'gsc'; if (!gscConnected && $auth.user) checkGscStatus(); }}>📈 Search Console {#if gscConnected}<span class="gsc-dot"></span>{/if}</button>
			<button class="seo-tab" class:active={activeTab === 'history'} onclick={() => { activeTab = 'history'; loadSeoHistory(); }}>📋 History</button>
		</div>

		<!-- ════ KEYWORDS ════ -->
		{#if activeTab === 'keywords'}
			<div class="tab-panel animate-fade-up">
				<div class="card">
					<div class="card-header">
						<span>🔍</span>
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
								<div class="kw-section-title">🔗 Preposition Variations ({kwData.prepositions.length})</div>
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
								<div class="kw-section-title">⚔️ Comparison Keywords ({kwData.comparisons.length})</div>
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
								<div class="kw-section-title">🎯 Long-Tail Ideas ({kwData.long_tail.length})</div>
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
						<span>🔗</span>
						<span style="font-weight: 700;">Backlink Analysis</span>
						{#if !isPaid}<span class="badge badge-blue" style="margin-left: auto;">Pro</span>{/if}
					</div>
					<div class="card-body">
						{#if isPaid}
							<div class="search-row">
								<input class="input" type="text" placeholder="Enter domain (e.g. example.com)" bind:value={blInput} onkeydown={blKeydown} style="flex: 1;" />
								<button class="btn btn-blue" disabled={blLoading} onclick={searchBacklinks}>
									{#if blLoading}<span class="spinner spinner-sm"></span>{:else}Analyse{/if}
								</button>
							</div>
							{#if blError}<div class="msg-error">{blError}</div>{/if}
						{:else}
							<div class="upgrade-gate">
								<div style="font-size: 24px; margin-bottom: 8px;">🔗</div>
								<h3>Backlink Analysis</h3>
								<p class="text-secondary" style="max-width: 400px; margin: 0 auto;">Analyse your backlink profile: referring domains, link quality, anchor text distribution, and top linkers.</p>
								<a href="/#pricing" class="btn btn-gold" style="margin-top: 16px;">Upgrade to Pro — £9/mo</a>
							</div>
						{/if}
					</div>
				</div>

				{#if blLoading}
					<div style="margin-top: 16px;"><Skeleton lines={4} /></div>
				{/if}

				{#if blData}
					<div class="bl-results">
						<!-- Overview Stats -->
						<div class="bl-stats-grid">
							<div class="bl-stat">
								<div class="bl-stat-label">Total Backlinks</div>
								<div class="bl-stat-value">{blData.total_backlinks ?? '—'}</div>
							</div>
							<div class="bl-stat">
								<div class="bl-stat-label">Referring Domains</div>
								<div class="bl-stat-value">{blData.referring_domains ?? '—'}</div>
							</div>
							<div class="bl-stat">
								<div class="bl-stat-label">Link Influence</div>
								<div class="bl-stat-value">{blData.link_influence_score ?? '—'}</div>
							</div>
							<div class="bl-stat">
								<div class="bl-stat-label">Nofollow %</div>
								<div class="bl-stat-value">{blData.nofollow_percentage ?? '—'}%</div>
							</div>
						</div>

						{#if blData.link_quality}
							<div class="bl-quality" class:quality-good={blData.link_quality === 'good' || blData.link_quality === 'excellent'} class:quality-bad={blData.link_quality === 'poor'}>
								Link Quality: <strong>{sanitize(blData.link_quality)}</strong>
							</div>
						{/if}

						<!-- Top Anchors -->
						{#if blData.top_anchors?.length}
							<div class="card" style="margin-top: 16px;">
								<div class="card-header">
									<span>⚓</span>
									<span style="font-weight: 700; font-size: 13px;">Top Anchor Texts</span>
								</div>
								<div class="card-body" style="padding: 0;">
									{#each blData.top_anchors.slice(0, 10) as anchor}
										<div class="bl-row">
											<span class="bl-anchor">{sanitize(typeof anchor === 'string' ? anchor : anchor.text || anchor.anchor || '')}</span>
											{#if typeof anchor === 'object' && anchor.count}
												<span class="bl-count font-mono">{anchor.count}</span>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Top Referring Domains -->
						{#if blData.top_referring_domains?.length}
							<div class="card" style="margin-top: 16px;">
								<div class="card-header">
									<span>🌐</span>
									<span style="font-weight: 700; font-size: 13px;">Top Referring Domains</span>
								</div>
								<div class="card-body" style="padding: 0;">
									{#each blData.top_referring_domains.slice(0, 10) as domain}
										<div class="bl-row">
											<span class="bl-domain">{sanitize(typeof domain === 'string' ? domain : domain.domain || domain.url || '')}</span>
											{#if typeof domain === 'object' && domain.links}
												<span class="bl-count font-mono">{domain.links} links</span>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<div class="bl-source text-muted">Source: {sanitize(blData.source || 'Unknown')}</div>
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
							<span>📈</span>
							<span style="font-weight: 700;">Google Search Console</span>
							<span class="badge badge-gold" style="margin-left: auto;">Free</span>
						</div>
						<div class="card-body" style="text-align: center; padding: 32px;">
							<div style="font-size: 28px; margin-bottom: 8px;">📈</div>
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
							<span>📈</span>
							<span style="font-weight: 700;">Google Search Console</span>
							<div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
								<span class="gsc-connected-badge">✓ Connected</span>
								<button class="btn-text-danger" disabled={gscDisconnecting} onclick={disconnectGSC}>
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
									<span>📊</span>
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
									<span>🔍</span>
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
									<span>🎯</span>
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
									<div style="font-size: 28px; margin-bottom: 8px;">📭</div>
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
						<span>📋</span>
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
									<div class="hist-type">{item.type === 'backlinks' ? '🔗' : '🔍'}</div>
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
