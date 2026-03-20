<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { scan } from '$lib/stores/scan';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { chat } from '$lib/stores/chat';
	import { normalizeUrl, extractDomain, scoreColor, scoreLevel, scoreLevelText } from '$lib/utils/score';
	import { sanitize, sanitizeWithBreaks, sanitizeUrl, safeFaviconUrl, safeGetStorage, safeSetStorage } from '$lib/utils/security';
	import { SCORE_CATEGORIES } from '$lib/types';
	import type { Plan } from '$lib/types';
	import * as api from '$lib/api/client';

	import Terminal from '$lib/components/scanner/Terminal.svelte';
	import ScoreRing from '$lib/components/scanner/ScoreRing.svelte';
	import ScoreCard from '$lib/components/scanner/ScoreCard.svelte';
	import Pricing from '$lib/components/scanner/Pricing.svelte';
	import Enrichment from '$lib/components/scanner/Enrichment.svelte';
	import Badges from '$lib/components/scanner/Badges.svelte';
	import FeatureCards from '$lib/components/scanner/FeatureCards.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	import Seo from '$lib/components/ui/Seo.svelte';
	import { createCooldown, debounce } from '$lib/utils/ratelimit';

	const scanCooldown = createCooldown(3000); // 3s between scans

	let urlInput = $state('');
	let showGate = $state(false);
	let gateEmail = $state('');
	let gateName = $state('');
	let gateError = $state(false);
	let gateLoading = $state(false);
	let scansRemaining = $state(3);
	let userPlan: Plan = $state('guest');

	// Detail panel
	let openDetail = $state<string | null>(null);

	// PDF download
	let pdfDownloading = $state(false);
	let pdfError = $state('');

	// AI Fix Generator
	let aiFixes = $state<Record<string, any>>({});
	let aiFixLoading = $state<Record<string, boolean>>({});

	async function getAiFixForIssue(issue: any) {
		const key = issue.title;
		if (aiFixes[key] || aiFixLoading[key]) return;
		aiFixLoading = { ...aiFixLoading, [key]: true };
		try {
			const fix = await api.getAiFix({
				issue_title: issue.title,
				issue_description: issue.description,
				issue_category: issue.category || 'general',
				issue_severity: issue.severity || 'warning',
				url: $scan.currentUrl || '',
				current_value: undefined,
			});
			aiFixes = { ...aiFixes, [key]: fix };
		} catch (err) {
			aiFixes = { ...aiFixes, [key]: { error: 'Failed to generate fix. Try again.' } };
		}
		aiFixLoading = { ...aiFixLoading, [key]: false };
	}
	async function handlePdfDownload() {
		if (!r?.id || pdfDownloading) return;
		pdfDownloading = true;
		pdfError = '';
		try {
			const domain = $scan.currentUrl?.replace('https://', '').replace('http://', '').split('/')[0] || 'site';
			await api.downloadPdf(r.id, `bscan-${domain}.pdf`);
		} catch (err) {
			pdfError = err instanceof Error ? err.message : 'Download failed';
		}
		pdfDownloading = false;
	}

	// Challenge landing (?challenge=xxx)
	let challengeBanner = $state<{ domain: string; score: number; achievements: any[] } | null>(null);

	onMount(async () => {
		const saved = safeGetStorage('bscan_email');
		if (saved) gateEmail = saved;
		const savedName = safeGetStorage('bscan_name');
		if (savedName) gateName = savedName;

		// Handle challenge URL
		const params = new URLSearchParams(window.location.search);
		const challengeId = params.get('challenge');
		if (challengeId) {
			try {
				const ch = await api.getScanChallenge(challengeId);
				if (ch.domain && ch.score) {
					challengeBanner = { domain: ch.domain, score: ch.score, achievements: ch.achievements || [] };
				}
			} catch { /* silently fail */ }
		}
	});

	const quickUrls = [
		{ url: 'https://balancewises.io', label: 'balancewises.io' },
		{ url: 'https://shopbalancewise.com', label: 'shopbalancewise.com' },
		{ url: 'https://google.com', label: 'google.com' }
	];

	function setQuickUrl(url: string) {
		urlInput = url;
	}

	async function handleScan() {
		if (!urlInput.trim()) return;
		if (!scanCooldown.canFire()) return; // Rate limit: 3s cooldown
		scanCooldown.fire();
		const url = normalizeUrl(urlInput);

		// If we have a saved email, skip gate
		const savedEmail = safeGetStorage('bscan_email');
		if (savedEmail && safeGetStorage('bscan_token')) {
			gateEmail = savedEmail;
			await runFullScan(url);
			return;
		}

		if (savedEmail) {
			gateEmail = savedEmail;
			await runFullScan(url);
			return;
		}

		// Show email gate
		showGate = true;
	}

	async function submitGate() {
		if (!gateEmail || !gateEmail.includes('@') || !gateEmail.includes('.')) {
			gateError = true;
			return;
		}
		gateError = false;
		gateLoading = true;

		safeSetStorage('bscan_email', gateEmail);
		if (gateName) safeSetStorage('bscan_name', gateName);

		const url = normalizeUrl(urlInput);

		try {
			const check = await api.checkScanAllowance(gateEmail);
			scansRemaining = check.scans_remaining;
			userPlan = check.plan;

			if (!check.can_scan) {
				showGate = false;
				gateLoading = false;
				ui.showPaywall(
					check.has_account ? 'Scan limit reached' : "You've used your 3 free scans",
					check.message || 'Create an account and upgrade to Pro for 30 scans/month.'
				);
				return;
			}

			showGate = false;
			await runFullScan(url);
		} catch {
			showGate = false;
			await runFullScan(url);
		}

		gateLoading = false;
	}

	async function runFullScan(url: string) {
		const plan = $auth.user?.plan || userPlan || 'guest';
		await scan.startScan(url, gateEmail, gateName, plan);

		// Link chat to scan
		if ($scan.lastScanId) {
			chat.setScanId($scan.lastScanId);
		}
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleScan();
	}

	function handleGateKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') submitGate();
	}

	function toggleDetail(key: string) {
		openDetail = openDetail === key ? null : key;
	}

	// Derived from scan result
	const r = $derived($scan.result);
	const overallScore = $derived(r?.overall_score ?? 0);
	const overallColor = $derived(scoreColor(overallScore));
	const overallLevel = $derived(scoreLevel(overallScore));

	const overallTitle = $derived(
		overallScore >= 80 ? 'Excellent — well optimised' :
		overallScore >= 60 ? 'Good — room for improvement' :
		overallScore >= 40 ? 'Needs work — multiple issues found' :
		'Critical — immediate action needed'
	);

	const overallDesc = $derived(
		overallScore >= 80 ? 'Only minor tweaks needed. Your site follows most best practices.' :
		overallScore >= 60 ? 'Solid foundation but several issues are affecting rankings and user experience.' :
		overallScore >= 40 ? 'Fixing these could significantly boost your visibility and conversions.' :
		'Major issues across multiple categories. This is costing you traffic right now.'
	);

	const scores = $derived({
		seo: r?.seo_score ?? 0,
		performance: r?.performance_score ?? 0,
		accessibility: r?.accessibility_score ?? 0,
		security: r?.security_score ?? 0,
		mobile: r?.mobile_score ?? 0,
		links: r?.links_score ?? 0
	});

	const isPaid = $derived($auth.isPaid || userPlan === 'pro' || userPlan === 'agency');
</script>

<Seo
	title="BSCAN — Free Website Audit | Balancewise Technologies"
	description="Scan any website instantly. Get a free SEO, performance, accessibility, and security audit with actionable fixes. Powered by Balancewise Technologies."
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "BSCAN Website Analyzer",
		"url": "https://bscan.balancewises.io/",
		"applicationCategory": "Web Application",
		"description": "Scan any website instantly! Get your Overall Score, detailed issue breakdown, tech stack, SSL grade, domain age, and an AI-powered summary.",
		"operatingSystem": "All",
		"offers": { "@type": "Offer", "price": "0.00", "priceCurrency": "GBP", "description": "Free website scan" }
	}}
/>

<div class="container">
	<!-- ── Hero ──────────────────────────────────────── -->
	<section class="hero">
		<div class="hero-badge badge badge-gold">BSCAN · Free Website Audit Tool</div>
		<h1>Audit Any Website.<br><span class="text-gold">Instantly.</span></h1>
		<p class="hero-sub">
			{#if challengeBanner}
				<strong class="text-gold">{sanitize(challengeBanner.domain)}</strong> scored
				<strong style="color: {scoreColor(challengeBanner.score)};">{challengeBanner.score}/100</strong>.
				Think your site is better? Paste your URL and find out.
			{:else}
				Paste a URL and get a full SEO, performance, accessibility, and security report with actionable fixes — in seconds.
			{/if}
		</p>

		<!-- Scan Input -->
		<div class="audit-box">
			<div class="audit-row">
				<input
					type="url"
					class="audit-input"
					id="url-input"
					placeholder="https://yourwebsite.com"
					autocomplete="off"
					inputmode="url"
					spellcheck="false"
					bind:value={urlInput}
					onkeydown={handleInputKeydown}
				/>
				<button
					class="btn btn-gold audit-btn"
					disabled={$scan.isScanning}
					onclick={handleScan}
				>
					{#if $scan.isScanning}
						<span class="spinner spinner-sm"></span> Scanning...
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
						BSCAN It
					{/if}
				</button>
				{#if $auth.user?.plan === 'agency'}
					<a href="/deep-crawl" class="btn btn-outline audit-btn-crawl">
						🕷️ Deep Crawl
					</a>
				{:else if $auth.user}
					<button class="btn btn-outline audit-btn-crawl" style="opacity: 0.6;" onclick={() => { alert('Deep Crawl is available on the Agency plan. Upgrade in your Account dashboard.'); }}>
						🔒 Deep Crawl
					</button>
				{:else}
					<a href="/account" class="btn btn-outline audit-btn-crawl" style="opacity: 0.6;">
						🔒 Deep Crawl
					</a>
				{/if}
			</div>

			<div class="quick-urls">
				{#each quickUrls as q}
					<button class="quick-url" onclick={() => setQuickUrl(q.url)}>{q.label}</button>
				{/each}
			</div>
		</div>

		<!-- Email Gate -->
		{#if showGate}
			<div class="gate animate-fade-up">
				<div class="gate-header">
					<span style="font-size: 1.3rem;">⚡</span>
					<div>
						<div class="gate-title">Almost there — enter your details to get your report</div>
						<div class="gate-sub">Scanning: {extractDomain(normalizeUrl(urlInput))}</div>
					</div>
				</div>
				<div class="gate-fields">
					<div class="field">
						<label class="label" for="gate-email">Email address *</label>
						<input class="input" class:input-error={gateError} type="email" id="gate-email" placeholder="you@company.com" autocomplete="email" bind:value={gateEmail} onkeydown={handleGateKeydown} />
					</div>
					<div class="field">
						<label class="label" for="gate-name">Business / your name</label>
						<input class="input" type="text" id="gate-name" placeholder="e.g. Acme Ltd" bind:value={gateName} onkeydown={handleGateKeydown} />
					</div>
				</div>
				<button class="btn btn-gold" style="width: 100%;" disabled={gateLoading} onclick={submitGate}>
					{#if gateLoading}
						<span class="spinner spinner-sm"></span> Checking...
					{:else}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
						Start Free Audit
					{/if}
				</button>
				<p class="gate-privacy">We'll send your report here. No spam, ever. See our <a href="https://balancewises.io/privacy.html" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>
			</div>
		{/if}

		<!-- Terminal -->
		<Terminal />
	</section>

	<!-- ── Results ──────────────────────────────────── -->
	{#if $scan.status === 'done' && r}
		<section class="results animate-slide-up" id="results">
			<!-- Results Bar -->
			<div class="results-bar">
				<span class="results-url font-mono">{$scan.currentUrl}</span>
				<div class="results-actions">
					{#if $auth.user && ($auth.isPaid)}
						<button class="btn btn-gold btn-sm" disabled={pdfDownloading} onclick={handlePdfDownload}>
							{#if pdfDownloading}<span class="spinner spinner-sm"></span>{:else}📄 Download PDF{/if}
						</button>
					{:else}
						<button class="btn btn-outline btn-sm" onclick={() => ui.showPaywall('PDF Export', 'Download a professional audit report as PDF. Upgrade to Pro to unlock.')}>📄 PDF Report</button>
					{/if}
					<button class="btn btn-outline btn-sm" onclick={() => { scan.reset(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>New Scan</button>
				</div>
			</div>
			{#if pdfError}<div class="msg-error" style="margin: 8px 0;">{pdfError}</div>{/if}

			<!-- Overall Score -->
			<div class="overall-row">
				<ScoreRing score={overallScore} />
				<div class="overall-text">
					<h3>{overallTitle}</h3>
					<p class="text-secondary">{overallDesc}</p>
				</div>
			</div>

			<!-- Summary -->
			{#if r.summary}
				<div class="summary-box" style="border-left-color: {overallColor};">
					{@html sanitizeWithBreaks(r.summary)}
				</div>
			{/if}

			<!-- Score Cards Grid -->
			<div class="scores-grid">
				{#each SCORE_CATEGORIES as cat}
					<ScoreCard
						category={cat.key}
						label={cat.label}
						icon={cat.icon}
						score={scores[cat.key]}
						issues={r.issues}
						enrichment={r.enrichment}
						onclick={() => toggleDetail(cat.key)}
					/>
				{/each}
			</div>

			<!-- Intelligence Feature Cards -->
			<FeatureCards scanData={r} {isPaid} />

			<!-- Detail Panel -->
			{#if openDetail}
				{@const catIssues = r.issues.filter((i) => i.category === openDetail)}
				{@const crits = catIssues.filter((i) => i.severity === 'critical')}
				{@const warns = catIssues.filter((i) => i.severity === 'warning')}
				{@const passes = catIssues.filter((i) => i.severity === 'pass')}
				{@const catScore = scores[openDetail as keyof typeof scores] ?? 0}
				{@const catInfo = SCORE_CATEGORIES.find((c) => c.key === openDetail)}

				<div class="detail-panel animate-fade-up">
					<div class="detail-header">
						<div class="detail-header-left">
							<div class="detail-badge {scoreLevel(catScore)}">{catScore}</div>
							<div>
								<div class="detail-title">{catInfo?.icon} {catInfo?.label}</div>
								<div class="detail-subtitle text-muted">{catIssues.length} checks · {crits.length} critical · {warns.length} warnings</div>
							</div>
						</div>
						<button class="btn btn-outline btn-sm" onclick={() => openDetail = null}>Close ✕</button>
					</div>
					<div class="detail-body">
						{#if crits.length}
							<div class="issue-group">
								<div class="group-label text-danger font-mono">CRITICAL ({crits.length})</div>
								{#each crits as issue, idx}
									<div class="issue-row" class:blurred={!isPaid && idx >= 2}>
										<div class="issue-icon crit">✗</div>
										<div class="issue-text">
											<strong>{issue.title}</strong><br/>
											{issue.description}
											{#if issue.fix && (isPaid || idx < 2)}
												<div class="issue-fix">Fix: {issue.fix}</div>
											{/if}
											{#if isPaid}
												<button class="btn-ai-fix" onclick={() => getAiFixForIssue(issue)} disabled={!!aiFixLoading[issue.title]}>
													{#if aiFixLoading[issue.title]}⏳ Generating...{:else if aiFixes[issue.title]}✅ View Code{:else}🤖 AI Fix{/if}
												</button>
												{#if aiFixes[issue.title] && !aiFixes[issue.title].error}
													{@const fix = aiFixes[issue.title]}
													<div class="ai-fix-panel">
														<div class="ai-fix-summary">{fix.fix_summary}</div>
														<div class="ai-fix-meta"><span class="ai-badge">{fix.priority || 'medium'}</span><span class="ai-badge">{fix.effort || '—'}</span></div>
														{#each (fix.code_snippets || []) as snippet}
															<div class="ai-code-block">
																<div class="ai-code-header"><span class="ai-code-lang">{snippet.language}</span><span class="ai-code-file">{snippet.filename}</span><button class="ai-copy-btn" onclick={() => navigator.clipboard.writeText(snippet.code)}>Copy</button></div>
																<pre class="ai-code">{snippet.code}</pre>
																<p class="ai-code-explain">{snippet.explanation}</p>
															</div>
														{/each}
														{#if fix.additional_notes}<p class="ai-notes">{fix.additional_notes}</p>{/if}
													</div>
												{:else if aiFixes[issue.title]?.error}
													<div class="ai-fix-error">{aiFixes[issue.title].error}</div>
												{/if}
											{/if}
										</div>
									</div>
								{/each}
								{#if !isPaid && crits.length > 2}
									<div class="lock-hint">🔒 {crits.length - 2} more hidden · <a href="#pricing" class="text-gold">Upgrade to see all</a></div>
								{/if}
							</div>
						{/if}

						{#if warns.length}
							<div class="issue-group">
								<div class="group-label text-gold font-mono">WARNINGS ({warns.length})</div>
								{#each warns as issue, idx}
									<div class="issue-row" class:blurred={!isPaid && idx >= 2}>
										<div class="issue-icon warn">⚠</div>
										<div class="issue-text">
											<strong>{issue.title}</strong><br/>
											{issue.description}
											{#if issue.fix && (isPaid || idx < 2)}
												<div class="issue-fix">Fix: {issue.fix}</div>
											{/if}
											{#if isPaid}
												<button class="btn-ai-fix" onclick={() => getAiFixForIssue(issue)} disabled={!!aiFixLoading[issue.title]}>
													{#if aiFixLoading[issue.title]}⏳ Generating...{:else if aiFixes[issue.title]}✅ View Code{:else}🤖 AI Fix{/if}
												</button>
												{#if aiFixes[issue.title] && !aiFixes[issue.title].error}
													{@const fix = aiFixes[issue.title]}
													<div class="ai-fix-panel">
														<div class="ai-fix-summary">{fix.fix_summary}</div>
														<div class="ai-fix-meta"><span class="ai-badge">{fix.priority || 'medium'}</span><span class="ai-badge">{fix.effort || '—'}</span></div>
														{#each (fix.code_snippets || []) as snippet}
															<div class="ai-code-block">
																<div class="ai-code-header"><span class="ai-code-lang">{snippet.language}</span><span class="ai-code-file">{snippet.filename}</span><button class="ai-copy-btn" onclick={() => navigator.clipboard.writeText(snippet.code)}>Copy</button></div>
																<pre class="ai-code">{snippet.code}</pre>
																<p class="ai-code-explain">{snippet.explanation}</p>
															</div>
														{/each}
													</div>
												{:else if aiFixes[issue.title]?.error}
													<div class="ai-fix-error">{aiFixes[issue.title].error}</div>
												{/if}
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}

						{#if passes.length}
							<div class="issue-group">
								<div class="group-label text-success font-mono">PASSED ({passes.length})</div>
								{#each passes.slice(0, isPaid ? 50 : 3) as issue}
									<div class="issue-row">
										<div class="issue-icon pass">✓</div>
										<div class="issue-text">{issue.title}</div>
									</div>
								{/each}
								{#if !isPaid && passes.length > 3}
									<div class="lock-hint">+ {passes.length - 3} more</div>
								{/if}
							</div>
						{/if}

						{#if crits.length > 0 || warns.length > 0}
							<div style="text-align: center; margin-top: 20px;">
								<a href="https://balancewises.io/#contact" target="_blank" rel="noopener noreferrer" class="btn btn-gold">Get Balancewise to Fix {catInfo?.label} →</a>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Enrichment Section (Tech Stack, SSL, WHOIS, etc.) -->
			{#if r.enrichment}
				<Enrichment enrichment={r.enrichment} {isPaid} />
			{/if}

			<!-- Achievement Badges & Challenge Sharing -->
			{#if r.id}
				<Badges scanId={r.id} overallScore={overallScore} />
			{/if}

			<!-- CTA Banner -->
			<div class="cta-banner">
				<div>
					<h3>Want us to fix these issues?</h3>
					<p class="text-secondary">Our team builds websites, APIs, and cloud infrastructure — we respond within 24 hours.</p>
				</div>
				<div class="cta-btns">
					<a href="https://balancewises.io/#contact" class="btn btn-gold">Get a Free Quote →</a>
					<a href="https://balancewises.io/#services" class="btn btn-outline">View Services</a>
				</div>
			</div>
		</section>
	{/if}

	<!-- ── Pricing ──────────────────────────────────── -->
	<Pricing />

	<!-- ── Paywall ──────────────────────────────────── -->
	{#if $ui.paywallOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="overlay" onclick={(e) => e.target === e.currentTarget && ui.closePaywall()} onkeydown={(e) => e.key === 'Escape' && ui.closePaywall()}>
			<div class="modal" style="text-align: center;">
				<h2>{$ui.paywallTitle}</h2>
				<p class="text-secondary" style="margin: 12px 0 24px; line-height: 1.6;">{$ui.paywallMessage}</p>
				<div style="display: flex; flex-direction: column; gap: 10px;">
					<a href="https://balancewises.io/#contact" class="btn btn-gold">Get Us to Fix Your Site →</a>
					<button class="btn btn-blue" onclick={() => { ui.closePaywall(); ui.openCheckout('pro'); }}>Upgrade to Pro · £9/month</button>
					<button class="btn btn-ghost" onclick={() => ui.closePaywall()}>Maybe later</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Challenge Landing Banner (fixed bottom) -->
{#if challengeBanner}
	{@const sc = challengeBanner.score}
	{@const bannerColor = sc >= 80 ? 'var(--clr-success)' : sc >= 60 ? 'var(--clr-info)' : sc >= 40 ? 'var(--clr-warning)' : 'var(--clr-danger)'}
	<div class="challenge-landing-banner">
		<div class="clb-inner">
			<div class="clb-score" style="background: {bannerColor}20; border-color: {bannerColor}; color: {bannerColor};">{sc}</div>
			<div class="clb-text">
				<div class="clb-title">{sanitize(challengeBanner.domain)} scored {sc}/100</div>
				<div class="clb-sub">Can your website beat it? Paste your URL above and find out!</div>
			</div>
			{#if challengeBanner.achievements.length > 0}
				<div class="clb-badges">
					{#each challengeBanner.achievements.slice(0, 3) as ach}
						<span class="clb-badge" style="background: {ach.color}15; color: {ach.color}; border-color: {ach.color}30;">
							{ach.icon} {sanitize(ach.title)}
						</span>
					{/each}
				</div>
			{/if}
			<button class="clb-close" onclick={() => challengeBanner = null} aria-label="Dismiss">✕</button>
		</div>
	</div>
{/if}

<style>
	/* ── Hero ──────────────────────────────────── */
	.hero {
		text-align: center;
		padding: var(--space-2xl) 0 var(--space-xl);
		max-width: 700px;
		margin: 0 auto;
	}

	.hero-badge {
		margin-bottom: var(--space-md);
	}

	.hero h1 {
		font-style: italic;
		margin-bottom: var(--space-md);
	}

	.hero-sub {
		color: var(--clr-text-secondary);
		font-size: 15px;
		line-height: 1.7;
		max-width: 520px;
		margin: 0 auto var(--space-xl);
	}

	/* ── Audit Box ─────────────────────────────── */
	.audit-box {
		max-width: 560px;
		margin: 0 auto;
	}

	.audit-row {
		display: flex;
		gap: 8px;
	}

	.audit-input {
		flex: 1;
		background: var(--clr-bg-input);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 14px 18px;
		font-size: 15px;
		color: var(--clr-text-primary);
		outline: none;
		font-family: var(--font-mono);
		transition: border-color var(--duration-fast);
		min-width: 0;
	}

	.audit-input:focus {
		border-color: var(--clr-gold);
		box-shadow: 0 0 0 3px var(--clr-gold-dim);
	}

	.audit-input::placeholder {
		color: var(--clr-text-muted);
		font-family: var(--font-sans);
	}

	.audit-btn {
		padding: 14px 24px;
		font-size: 14px;
		flex-shrink: 0;
	}

	.audit-btn-crawl {
		padding: 14px 18px;
		font-size: 13px;
		flex-shrink: 0;
		border-color: rgba(6, 182, 212, 0.3);
		color: #06b6d4;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: var(--radius-md);
		transition: all 0.15s;
	}
	.audit-btn-crawl:hover {
		background: rgba(6, 182, 212, 0.1);
		border-color: #06b6d4;
	}

	.quick-urls {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-top: var(--space-sm);
		flex-wrap: wrap;
	}

	.quick-url {
		font-size: 11px;
		padding: 4px 12px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--clr-border);
		color: var(--clr-text-muted);
		cursor: pointer;
		font-family: var(--font-mono);
		transition: all var(--duration-fast);
	}

	.quick-url:hover {
		background: var(--clr-bg-card);
		color: var(--clr-text-secondary);
		border-color: var(--clr-border-light);
	}

	/* ── Email Gate ─────────────────────────────── */
	.gate {
		margin-top: var(--space-lg);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		text-align: left;
		max-width: 460px;
		margin-left: auto;
		margin-right: auto;
	}

	.gate-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: var(--space-md);
	}

	.gate-title {
		font-weight: 700;
		font-size: 14px;
	}

	.gate-sub {
		font-size: 12px;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
	}

	.gate-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.gate-privacy {
		font-size: 11px;
		color: var(--clr-text-muted);
		text-align: center;
		margin-top: var(--space-sm);
	}

	/* ── Results ────────────────────────────────── */
	.results {
		margin-top: var(--space-xl);
	}

	.results-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-lg);
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.results-url {
		font-size: 13px;
		color: var(--clr-text-secondary);
	}

	.results-actions {
		display: flex;
		gap: 8px;
	}

	.overall-row {
		display: flex;
		align-items: center;
		gap: var(--space-xl);
		margin-bottom: var(--space-xl);
		flex-wrap: wrap;
	}

	.overall-text {
		flex: 1;
		min-width: 200px;
	}

	.overall-text h3 {
		margin-bottom: 6px;
	}

	.summary-box {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		border-left: 3px solid var(--clr-blue);
		padding: 16px 20px;
		margin-bottom: var(--space-lg);
		font-size: 13px;
		color: var(--clr-text-secondary);
		line-height: 1.7;
	}

	/* ── Scores Grid ───────────────────────────── */
	.scores-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
		gap: 12px;
		margin-bottom: var(--space-lg);
	}

	/* ── Detail Panel ──────────────────────────── */
	.detail-panel {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border-light);
		border-radius: var(--radius-xl);
		margin-bottom: var(--space-lg);
		overflow: hidden;
	}

	.detail-header {
		padding: 18px 22px;
		border-bottom: 1px solid var(--clr-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
	}

	.detail-header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.detail-badge {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -1px;
	}

	.detail-badge.excellent { background: var(--clr-success-dim); color: var(--clr-success); }
	.detail-badge.good { background: var(--clr-info-dim); color: var(--clr-info); }
	.detail-badge.warning { background: var(--clr-warning-dim); color: var(--clr-warning); }
	.detail-badge.poor { background: var(--clr-danger-dim); color: var(--clr-danger); }

	.detail-title {
		font-size: 16px;
		font-weight: 700;
	}

	.detail-subtitle {
		font-size: 12px;
	}

	.detail-body {
		padding: 18px 22px;
	}

	.issue-group {
		margin-bottom: var(--space-md);
	}

	.group-label {
		font-size: 11px;
		font-weight: 700;
		margin-bottom: 8px;
	}

	.issue-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-size: 12px;
		transition: background var(--duration-fast);
	}

	.issue-row:hover {
		background: var(--clr-bg-primary);
	}

	.blurred {
		filter: blur(4px);
		pointer-events: none;
		user-select: none;
	}

	.issue-icon {
		width: 20px;
		height: 20px;
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 700;
	}

	.issue-icon.crit { background: var(--clr-danger-dim); color: var(--clr-danger); }
	.issue-icon.warn { background: var(--clr-warning-dim); color: var(--clr-warning); }
	.issue-icon.pass { background: var(--clr-success-dim); color: var(--clr-success); }

	.issue-text {
		flex: 1;
		color: var(--clr-text-secondary);
		line-height: 1.5;
	}

	.issue-text strong {
		color: var(--clr-text-primary);
		font-weight: 600;
	}

	.issue-fix {
		color: var(--clr-blue);
		font-size: 11px;
		font-style: italic;
		margin-top: 3px;
	}

	/* AI Fix Generator */
	.btn-ai-fix { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 5px 12px; font-size: 11px; font-weight: 600; background: linear-gradient(135deg, #1e40af, #7c3aed); color: white; border: none; border-radius: 6px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
	.btn-ai-fix:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
	.btn-ai-fix:disabled { opacity: 0.6; cursor: wait; }
	.ai-fix-panel { margin-top: 10px; padding: 14px; background: var(--clr-bg-deep); border: 1px solid rgba(124,58,237,0.2); border-radius: 8px; }
	.ai-fix-summary { font-size: 13px; font-weight: 600; color: var(--clr-text-primary); margin-bottom: 8px; }
	.ai-fix-meta { display: flex; gap: 6px; margin-bottom: 10px; }
	.ai-badge { padding: 2px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--clr-text-muted); font-family: var(--font-mono); }
	.ai-fix-error { font-size: 12px; color: var(--clr-danger); padding: 8px; background: rgba(239,68,68,0.08); border-radius: 6px; margin-top: 8px; }
	.ai-code-block { margin-top: 8px; border: 1px solid var(--clr-border); border-radius: 6px; overflow: hidden; }
	.ai-code-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--clr-border); font-size: 10px; }
	.ai-code-lang { font-weight: 700; color: var(--clr-blue); text-transform: uppercase; font-family: var(--font-mono); }
	.ai-code-file { color: var(--clr-text-muted); font-family: var(--font-mono); }
	.ai-copy-btn { margin-left: auto; padding: 2px 8px; font-size: 10px; background: rgba(59,130,246,0.1); color: var(--clr-blue); border: 1px solid rgba(59,130,246,0.2); border-radius: 4px; cursor: pointer; font-family: inherit; }
	.ai-copy-btn:hover { background: rgba(59,130,246,0.2); }
	.ai-code { margin: 0; padding: 12px; font-size: 12px; font-family: var(--font-mono); color: var(--clr-text-secondary); line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-word; background: transparent; }
	.ai-code-explain { font-size: 11px; color: var(--clr-text-muted); padding: 8px 10px; border-top: 1px solid var(--clr-border); margin: 0; }
	.ai-notes { font-size: 11px; color: var(--clr-text-muted); margin-top: 8px; font-style: italic; }

	.lock-hint {
		text-align: center;
		padding: 10px;
		font-size: 11px;
		color: var(--clr-text-muted);
	}

	/* ── CTA Banner ─────────────────────────────── */
	.cta-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		padding: var(--space-lg);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-xl);
		margin-top: var(--space-xl);
		flex-wrap: wrap;
	}

	.cta-btns {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	/* ── Mobile ──────────────────────────────────── */
	@media (max-width: 640px) {
		.audit-row {
			flex-direction: column;
		}

		.audit-btn {
			width: 100%;
		}

		.overall-row {
			flex-direction: column;
			text-align: center;
		}

		.scores-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.cta-banner {
			text-align: center;
		}

		.cta-btns {
			width: 100%;
			justify-content: center;
		}
	}

	/* ── Challenge Landing Banner ───────────── */
	.challenge-landing-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 90;
		background: linear-gradient(135deg, var(--clr-bg-card), var(--clr-bg-elevated));
		border-top: 2px solid var(--clr-gold);
		padding: 14px 24px;
		animation: fadeUp 0.4s var(--ease-out);
	}

	.clb-inner {
		max-width: var(--max-width);
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}

	.clb-score {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		border: 2px solid;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		font-weight: 800;
		font-family: var(--font-mono);
		flex-shrink: 0;
	}

	.clb-text { flex: 1; min-width: 200px; }
	.clb-title { font-weight: 700; font-size: 14px; }
	.clb-sub { font-size: 12px; color: var(--clr-gold); }

	.clb-badges {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.clb-badge {
		font-size: 10px;
		padding: 3px 10px;
		border-radius: var(--radius-full);
		border: 1px solid;
		font-family: var(--font-mono);
		font-weight: 600;
		white-space: nowrap;
	}

	.clb-close {
		background: none;
		border: none;
		color: var(--clr-text-muted);
		cursor: pointer;
		font-size: 18px;
		padding: 4px 8px;
		flex-shrink: 0;
	}

	.clb-close:hover { color: var(--clr-text-primary); }

	@media (max-width: 640px) {
		.clb-badges { display: none; }
		.challenge-landing-banner { padding: 12px 16px; }
	}
</style>
