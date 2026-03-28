<script lang="ts">
	import { ui } from '$lib/stores/ui';
	import { auth } from '$lib/stores/auth';
	import Seo from '$lib/components/ui/Seo.svelte';
	import { PLAN_PRICING } from '$lib/types';

	let interval = $derived($ui.billingInterval);
	let proPrice  = $derived(PLAN_PRICING.pro[interval]);
	let agencyPrice = $derived(PLAN_PRICING.agency[interval]);
	let user = $derived($auth.user);
	let plan = $derived(user?.plan || 'free');

	let openFaq = $state<number | null>(null);

	// ── Feature matrix ───────────────────────────────────
	type Val = boolean | string;
	interface Row { label: string; free: Val; pro: Val; agency: Val; soon?: boolean; tooltip?: string; }
	interface Section { title: string; icon: string; rows: Row[] }

	const matrix: Section[] = [
		{
			title: 'Core Scanning',
			icon: '🔍',
			rows: [
				{ label: 'Monthly scans',                  free: '3',         pro: '30',          agency: 'Unlimited' },
				{ label: '6-category audit (25+ checks)',  free: true,        pro: true,          agency: true },
				{ label: 'Core Web Vitals (LCP, CLS, TBT)',free: false,       pro: true,          agency: true },
				{ label: 'Deep page rendering (JS apps)',  free: false,       pro: false,         agency: true },
				{ label: 'Bulk scan (up to 25 URLs)',      free: false,       pro: false,         agency: true },
				{ label: 'Screenshot capture',             free: true,        pro: true,          agency: true },
				{ label: 'Tech stack detection',           free: true,        pro: true,          agency: true },
				{ label: 'WHOIS & domain intelligence',    free: true,        pro: true,          agency: true },
				{ label: 'SSL & security grading',         free: true,        pro: true,          agency: true },
				{ label: 'W3C validation',                 free: true,        pro: true,          agency: true },
				{ label: 'Wayback Machine archive check',  free: true,        pro: true,          agency: true },
			]
		},
		{
			title: 'AI & Intelligence',
			icon: '🤖',
			rows: [
				{ label: 'AI chat assistant',              free: true,        pro: true,          agency: true },
				{ label: 'Basic AI summary',               free: true,        pro: true,          agency: true },
				{ label: 'Advanced AI-powered summary',    free: false,       pro: true,          agency: true },
				{ label: 'AI fix generator (per issue)',   free: false,       pro: true,          agency: true },
				{ label: 'AI SEO strategy report',         free: false,       pro: false,         agency: true },
				{ label: 'Business intelligence',          free: false,       pro: true,          agency: true, tooltip: 'CTAs, payment methods, email capture, urgency tactics, social proof' },
				{ label: 'Consumer intelligence',          free: false,       pro: true,          agency: true, tooltip: 'Reviews, trust signals, loyalty programs, pricing psychology' },
				{ label: 'UX pattern detection',           free: false,       pro: true,          agency: true, tooltip: '30+ UX patterns across navigation, conversion, mobile, and trust' },
				{ label: 'Industry benchmarking',          free: false,       pro: true,          agency: true, tooltip: 'Percentile scores vs your industry peers' },
			]
		},
		{
			title: 'SEO Tools',
			icon: '📈',
			rows: [
				{ label: 'Keyword research',               free: 'Unlimited', pro: 'Unlimited',   agency: 'Unlimited' },
				{ label: 'Google Search Console rankings', free: true,        pro: true,          agency: true },
				{ label: 'Backlink overview',              free: false,       pro: true,          agency: true },
				{ label: 'Competitor compare tool',        free: false,       pro: true,          agency: true },
				{ label: 'SEO autocomplete',               free: true,        pro: true,          agency: true },
				{ label: 'Compare history',                free: false,       pro: true,          agency: true },
			]
		},
		{
			title: 'History & Export',
			icon: '📄',
			rows: [
				{ label: 'Scan history dashboard',         free: false,       pro: true,          agency: true },
				{ label: 'PDF report export',              free: false,       pro: 'Branded',     agency: 'White-label' },
				{ label: 'White-label PDF (your brand)',   free: false,       pro: false,         agency: true },
				{ label: 'Scheduled email reports',        free: false,       pro: false,         agency: true },
				{ label: 'CSV / JSON export',              free: false,       pro: true,          agency: true, soon: true },
				{ label: 'Score history graph',            free: false,       pro: true,          agency: true },
			]
		},
		{
			title: 'Monitoring & Alerts',
			icon: '🔔',
			rows: [
				{ label: 'Monitored sites',                free: false,       pro: '3 sites',     agency: '10 sites' },
				{ label: 'Monitoring frequency',           free: false,       pro: 'Weekly',      agency: 'Daily' },
				{ label: 'Score drop alerts',              free: false,       pro: true,          agency: true },
				{ label: 'Push notifications',             free: false,       pro: true,          agency: true },
				{ label: 'Slack / webhook alerts',         free: false,       pro: false,         agency: true, soon: true },
				{ label: 'Change detection / diff view',   free: false,       pro: true,          agency: true, soon: true },
			]
		},
		{
			title: 'Team & Collaboration',
			icon: '👥',
			rows: [
				{ label: 'Team members',                   free: '1',         pro: '1',           agency: '5' },
				{ label: 'Team management dashboard',      free: false,       pro: false,         agency: true },
				{ label: 'Shared team notes',              free: false,       pro: false,         agency: true },
				{ label: 'Team activity feed',             free: false,       pro: false,         agency: true },
				{ label: 'Client portal (read-only)',      free: false,       pro: false,         agency: true, soon: true },
			]
		},
		{
			title: 'API & Developer',
			icon: '🔌',
			rows: [
				{ label: 'API keys',                       free: false,       pro: '1 key',       agency: '5 keys' },
				{ label: 'REST API access',                free: false,       pro: true,          agency: true },
				{ label: 'API documentation',              free: true,        pro: true,          agency: true },
				{ label: 'Webhook integrations',           free: false,       pro: false,         agency: true, soon: true },
			]
		},
		{
			title: 'Viral & Community',
			icon: '🏆',
			rows: [
				{ label: 'Achievement badges',             free: true,        pro: true,          agency: true },
				{ label: 'Embeddable score badge',         free: true,        pro: true,          agency: true },
				{ label: 'Challenge sharing',              free: true,        pro: true,          agency: true },
				{ label: 'Public leaderboard',             free: true,        pro: true,          agency: true },
				{ label: 'Referral rewards (1mo Pro)',     free: true,        pro: true,          agency: true },
				{ label: 'Public shareable scan URL',      free: true,        pro: true,          agency: true, soon: true },
			]
		},
		{
			title: 'Support',
			icon: '🛡️',
			rows: [
				{ label: 'Email support',                  free: 'Community', pro: true,          agency: 'Priority' },
				{ label: 'Priority support',               free: false,       pro: false,         agency: true },
				{ label: 'Early access to new features',   free: false,       pro: false,         agency: true },
				{ label: 'Dedicated account manager',      free: false,       pro: false,         agency: true, soon: true },
			]
		},
	];

	const faqs = [
		{ q: 'Can I try BSCAN for free?', a: 'Yes — no card required. You get 3 full scans per month on the Free plan forever. Every scan runs all 6 audit categories with 25+ checks, AI summary, keyword extraction, and embeddable badges.' },
		{ q: 'What counts as a scan?', a: 'Each URL you audit counts as one scan. Running the same URL twice counts as two scans. Deep crawl and bulk scan each count separately per URL processed.' },
		{ q: 'Do you offer annual billing?', a: 'Yes. Annual billing saves you 20% — Pro drops from £9 to £7/mo and Agency from £29 to £23/mo. Switch to annual in the billing toggle above.' },
		{ q: 'Can I cancel anytime?', a: 'Absolutely. Cancel through your Stripe billing portal at any time. You keep access until the end of your current billing period — no penalties, no questions.' },
		{ q: 'What is the white-label PDF?', a: 'Agency users can add their own brand name, colour, and logo to every PDF report they export. Clients see your brand, not BSCAN. Perfect for presenting to clients.' },
		{ q: 'What are scheduled client reports?', a: 'Agency users can configure automatic weekly, fortnightly, or monthly scans of client websites. BSCAN scans the site, generates an AI-powered audit, and emails a branded HTML report directly to your client.' },
		{ q: 'What is the competitor compare tool?', a: 'Paste two URLs and BSCAN audits both simultaneously, producing a head-to-head score comparison across all six categories with a visual breakdown of where each site wins and loses.' },
		{ q: 'Is the API available to all paid users?', a: 'Pro users get 1 API key. Agency users get 5. The API lets you trigger scans, fetch results, and integrate BSCAN into your own tools and dashboards. Full docs at /api-docs.' },
		{ q: 'What\'s "coming soon"?', a: 'Features marked "Soon" are actively being built — they\'re in the codebase or on the immediate roadmap. Agency users get early access to everything as it ships.' },
	];

	function val(v: Val): { type: 'bool' | 'str'; value: boolean | string } {
		if (typeof v === 'boolean') return { type: 'bool', value: v };
		return { type: 'str', value: v };
	}
</script>

<Seo
	title="Pricing — BSCAN"
	description="Free, Pro £9/mo, and Agency £29/mo. Full website audit platform with AI fixes, competitor compare, monitoring, white-label reports, and scheduled client audits."
/>

<div class="bg-mesh"></div>
<div class="bg-grid"></div>

<div class="page">
<div class="container">

	<!-- ── Hero ───────────────────────────────────────── -->
	<div class="hero animate-fade-up">
		<span class="badge badge-gold">Pricing</span>
		<h1>Simple, honest <span class="text-gold">pricing</span></h1>
		<p class="hero-sub">Start free. Upgrade when you need more power. No hidden fees, cancel anytime.</p>

		<!-- Billing toggle -->
		<div class="billing-toggle">
			<button
				class="toggle-btn"
				class:active={interval === 'monthly'}
				onclick={() => ui.setBillingInterval('monthly')}
			>Monthly</button>
			<button
				class="toggle-btn"
				class:active={interval === 'annual'}
				onclick={() => ui.setBillingInterval('annual')}
			>Annual <span class="save-pill">Save 20%</span></button>
		</div>
	</div>

	<!-- ── Plan Cards ──────────────────────────────────── -->
	<div class="plan-grid animate-fade-up">

		<!-- Free -->
		<div class="plan-card">
			<div class="plan-top">
				<div class="plan-icon">🆓</div>
				<div class="plan-name">Free</div>
				<div class="plan-price-row">
					<span class="plan-price">£0</span>
					<span class="plan-cadence">forever</span>
				</div>
				<p class="plan-tagline">Perfect for quick checks and getting started.</p>
				<a href="/" class="btn btn-outline" style="width:100%;">Start Scanning →</a>
			</div>
			<ul class="plan-highlights">
				<li>3 scans per month</li>
				<li>6-category audit, 25+ checks</li>
				<li>AI chat + basic summary</li>
				<li>Keyword research (unlimited)</li>
				<li>Achievement badges & leaderboard</li>
				<li>Embeddable score badge</li>
				<li>Challenge sharing</li>
			</ul>
		</div>

		<!-- Pro -->
		<div class="plan-card featured">
			<div class="popular-tag">Most Popular</div>
			<div class="plan-top">
				<div class="plan-icon">⚡</div>
				<div class="plan-name">Pro</div>
				<div class="plan-price-row">
					<span class="plan-price">£{proPrice}</span>
					<span class="plan-cadence">/ mo{interval === 'annual' ? ' · billed annually' : ''}</span>
				</div>
				{#if interval === 'annual'}
					<div class="annual-saving">Save £{(9 - proPrice) * 12}/year vs monthly</div>
				{/if}
				<p class="plan-tagline">Full audit power for freelancers and growing businesses.</p>
				{#if plan === 'pro'}
					<div class="current-plan-badge">✓ Your current plan</div>
				{:else}
					<button class="btn btn-gold" style="width:100%;" onclick={() => ui.openCheckout('pro')}>
						{plan === 'agency' ? 'Switch to Pro' : 'Upgrade to Pro →'}
					</button>
				{/if}
			</div>
			<ul class="plan-highlights">
				<li>30 scans per month</li>
				<li>Core Web Vitals (LCP, CLS, TBT)</li>
				<li>Advanced AI summary + fix generator</li>
				<li>Business & consumer intelligence</li>
				<li>Industry benchmarking</li>
				<li>Competitor compare tool</li>
				<li>Scan history dashboard</li>
				<li>Branded PDF reports</li>
				<li>Site monitoring (3 sites)</li>
				<li>Backlink overview</li>
				<li>1 API key</li>
			</ul>
		</div>

		<!-- Agency -->
		<div class="plan-card agency-card">
			<div class="plan-top">
				<div class="plan-icon">🏢</div>
				<div class="plan-name">Agency</div>
				<div class="plan-price-row">
					<span class="plan-price">£{agencyPrice}</span>
					<span class="plan-cadence">/ mo{interval === 'annual' ? ' · billed annually' : ''}</span>
				</div>
				{#if interval === 'annual'}
					<div class="annual-saving" style="color: var(--clr-blue);">Save £{(29 - agencyPrice) * 12}/year vs monthly</div>
				{/if}
				<p class="plan-tagline">For agencies and teams managing multiple client sites.</p>
				{#if plan === 'agency'}
					<div class="current-plan-badge" style="color:var(--clr-blue);">✓ Your current plan</div>
				{:else}
					<button class="btn btn-blue" style="width:100%;" onclick={() => ui.openCheckout('agency')}>
						Go Agency →
					</button>
				{/if}
			</div>
			<ul class="plan-highlights">
				<li>Unlimited scans</li>
				<li>Deep page rendering (JS apps)</li>
				<li>AI SEO strategy reports</li>
				<li>Scheduled client reports (auto-email)</li>
				<li>White-label PDF with your branding</li>
				<li>5 team members + management</li>
				<li>10 monitored sites</li>
				<li>Bulk scan (up to 25 URLs)</li>
				<li>5 API keys</li>
				<li>Priority support + early access</li>
			</ul>
		</div>
	</div>

	<!-- ── Full Feature Matrix ─────────────────────────── -->
	<div class="matrix-wrap animate-fade-up">
		<div class="matrix-header-row">
			<h2 class="matrix-title">Everything, <span class="text-gold">compared</span></h2>
			<p class="text-secondary" style="font-size: 14px; margin-top: 8px;">Every feature across every plan. Features marked <span class="soon-pill-inline">Soon</span> are actively being built.</p>
		</div>

		<!-- Sticky column headers -->
		<div class="matrix-cols-header">
			<div class="mc-feature-col"></div>
			<div class="mc-col">Free</div>
			<div class="mc-col gold">Pro</div>
			<div class="mc-col blue">Agency</div>
		</div>

		{#each matrix as section}
			<div class="matrix-section">
				<div class="ms-title">
					<span class="ms-icon">{section.icon}</span>
					{section.title}
				</div>
				{#each section.rows as row}
					<div class="ms-row">
						<div class="ms-label">
							{row.label}
							{#if row.soon}<span class="soon-pill">Soon</span>{/if}
							{#if row.tooltip}<span class="tooltip-wrap" data-tip={row.tooltip}>ℹ</span>{/if}
						</div>
						{#each ['free', 'pro', 'agency'] as col}
							{@const v = val(row[col as 'free' | 'pro' | 'agency'])}
							<div class="ms-cell" class:gold-col={col === 'pro'} class:blue-col={col === 'agency'}>
								{#if v.type === 'bool'}
									{#if v.value}
										<span class="check">✓</span>
									{:else}
										<span class="dash">—</span>
									{/if}
								{:else}
									<span class="ms-val">{v.value}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/each}

		<!-- Bottom CTA row -->
		<div class="matrix-cta-row">
			<div class="mc-feature-col"></div>
			<div class="mc-col">
				<a href="/" class="btn btn-outline btn-sm">Start Free</a>
			</div>
			<div class="mc-col">
				{#if plan === 'pro'}
					<span style="font-size:12px; color:var(--clr-gold); font-weight:700;">✓ Active</span>
				{:else}
					<button class="btn btn-gold btn-sm" onclick={() => ui.openCheckout('pro')}>Get Pro</button>
				{/if}
			</div>
			<div class="mc-col">
				{#if plan === 'agency'}
					<span style="font-size:12px; color:var(--clr-blue); font-weight:700;">✓ Active</span>
				{:else}
					<button class="btn btn-blue btn-sm" onclick={() => ui.openCheckout('agency')}>Go Agency</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- ── Why Upgrade callout ─────────────────────────── -->
	<div class="callout-grid animate-fade-up">
		<div class="callout-card">
			<div class="callout-icon">🏷️</div>
			<h3>White-Label Reports</h3>
			<p>Send clients branded PDF audits with your agency name, colours, and logo. They see your brand — not BSCAN.</p>
			<span class="callout-plan badge-blue-sm">Agency</span>
		</div>
		<div class="callout-card">
			<div class="callout-icon">📅</div>
			<h3>Scheduled Client Reports</h3>
			<p>BSCAN automatically scans client sites weekly, fortnightly, or monthly and emails a branded audit report — while you sleep.</p>
			<span class="callout-plan badge-blue-sm">Agency</span>
		</div>
		<div class="callout-card">
			<div class="callout-icon">💼</div>
			<h3>Client Intelligence</h3>
			<p>Scan a prospect's site and instantly understand their CTAs, payment stack, trust signals, UX patterns, and industry ranking — before you even pitch.</p>
			<span class="callout-plan badge-gold-sm">Pro</span>
		</div>
		<div class="callout-card">
			<div class="callout-icon">⚔️</div>
			<h3>Competitor Compare</h3>
			<p>Head-to-head audit of any two sites across all six categories. Show clients exactly where their site wins and loses against their competition.</p>
			<span class="callout-plan badge-gold-sm">Pro</span>
		</div>
		<div class="callout-card">
			<div class="callout-icon">🔔</div>
			<h3>Monitoring & Alerts</h3>
			<p>BSCAN watches your clients' sites and alerts you the moment a score drops. Catch issues before your clients do.</p>
			<span class="callout-plan badge-gold-sm">Pro</span>
		</div>
		<div class="callout-card">
			<div class="callout-icon">🤖</div>
			<h3>AI Fix Generator</h3>
			<p>Every critical issue comes with AI-generated code fixes — complete with file names, language, and implementation steps. Not just problems, but solutions.</p>
			<span class="callout-plan badge-gold-sm">Pro</span>
		</div>
	</div>

	<!-- ── FAQ ────────────────────────────────────────── -->
	<div class="faq-wrap animate-fade-up">
		<div style="text-align: center; margin-bottom: var(--space-xl);">
			<span class="badge badge-gold">FAQ</span>
			<h2 style="margin-top: 12px;">Frequently asked <span class="text-gold">questions</span></h2>
		</div>
		<div class="faq-list">
			{#each faqs as faq, i}
				<div class="faq-item" class:open={openFaq === i}>
					<button class="faq-q" onclick={() => openFaq = openFaq === i ? null : i}>
						{faq.q}
						<span class="faq-chevron">{openFaq === i ? '−' : '+'}</span>
					</button>
					{#if openFaq === i}
						<div class="faq-a animate-fade-up">{faq.a}</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- ── Final CTA ──────────────────────────────────── -->
	<div class="final-cta animate-fade-up">
		<div class="final-cta-inner">
			<h2>Start with <span class="text-gold">free</span>, grow when you're ready</h2>
			<p class="text-secondary" style="margin-top: 8px; font-size: 15px;">No card required. 3 full audits every month, forever.</p>
			<div class="final-cta-btns">
				<a href="/" class="btn btn-gold" style="font-size: 15px; padding: 14px 32px;">Start Free Audit →</a>
				<button class="btn btn-outline" style="font-size: 15px; padding: 14px 32px;" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro · £{proPrice}/mo</button>
			</div>
			<p class="text-muted" style="font-size: 12px; margin-top: 16px;">Cancel anytime · Stripe-secured payments · Instant access</p>
		</div>
	</div>

</div>
</div>

<style>
	.page { padding-top: calc(var(--nav-height) + var(--space-xl)); }

	/* ── Hero ──────────────────────────────────────────── */
	.hero {
		text-align: center;
		padding: var(--space-xl) 0 var(--space-2xl);
	}

	.hero h1 { margin: var(--space-sm) 0 var(--space-md); }

	.hero-sub {
		font-size: 16px;
		color: var(--clr-text-secondary);
		max-width: 520px;
		margin: 0 auto var(--space-lg);
		line-height: 1.6;
	}

	.billing-toggle {
		display: inline-flex;
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 3px;
	}

	.toggle-btn {
		padding: 9px 24px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-family: inherit;
		background: transparent;
		color: var(--clr-text-secondary);
		transition: all var(--duration-fast);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toggle-btn.active {
		background: var(--clr-blue);
		color: white;
	}

	.save-pill {
		font-size: 10px;
		background: rgba(16,185,129,0.15);
		color: var(--clr-success);
		border-radius: 100px;
		padding: 2px 8px;
		font-weight: 700;
	}

	/* ── Plan Cards ────────────────────────────────────── */
	.plan-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
		margin-bottom: var(--space-2xl);
		align-items: start;
	}

	.plan-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-xl);
		padding: 28px;
		position: relative;
		transition: all var(--duration-normal) var(--ease-out);
	}

	.plan-card:hover {
		border-color: var(--clr-border-light);
		transform: translateY(-3px);
		box-shadow: var(--shadow-md);
	}

	.plan-card.featured {
		border-color: var(--clr-gold);
		box-shadow: var(--shadow-glow-gold);
	}

	.plan-card.agency-card {
		border-color: rgba(59,130,246,0.35);
	}

	.popular-tag {
		position: absolute;
		top: -12px;
		left: 50%;
		transform: translateX(-50%);
		padding: 4px 18px;
		background: var(--clr-gold);
		color: var(--clr-bg-deep);
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.plan-top { margin-bottom: var(--space-lg); }

	.plan-icon {
		font-size: 28px;
		margin-bottom: 8px;
	}

	.plan-name {
		font-size: 20px;
		font-weight: 800;
		margin-bottom: 4px;
	}

	.plan-price-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 4px;
	}

	.plan-price {
		font-size: 42px;
		font-weight: 800;
		letter-spacing: -2px;
		line-height: 1;
	}

	.plan-cadence {
		font-size: 13px;
		color: var(--clr-text-muted);
	}

	.annual-saving {
		font-size: 11px;
		color: var(--clr-success);
		font-weight: 700;
		margin-bottom: 8px;
		font-family: var(--font-mono);
	}

	.plan-tagline {
		font-size: 13px;
		color: var(--clr-text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-md);
	}

	.current-plan-badge {
		font-size: 13px;
		font-weight: 700;
		color: var(--clr-gold);
		padding: 10px 0;
		text-align: center;
	}

	.plan-highlights {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: var(--space-md);
		border-top: 1px solid var(--clr-border);
	}

	.plan-highlights li {
		font-size: 13px;
		color: var(--clr-text-secondary);
		padding-left: 18px;
		position: relative;
		line-height: 1.4;
	}

	.plan-highlights li::before {
		content: '✓';
		position: absolute;
		left: 0;
		color: var(--clr-success);
		font-weight: 700;
		font-size: 11px;
		top: 1px;
	}

	/* ── Feature Matrix ────────────────────────────────── */
	.matrix-wrap {
		margin-bottom: var(--space-2xl);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-xl);
		overflow: hidden;
	}

	.matrix-header-row {
		padding: 32px 32px 24px;
		border-bottom: 1px solid var(--clr-border);
	}

	.matrix-title { font-size: 26px; }

	.matrix-cols-header {
		display: grid;
		grid-template-columns: 1fr 110px 110px 110px;
		background: var(--clr-bg-elevated);
		border-bottom: 1px solid var(--clr-border);
		position: sticky;
		top: var(--nav-height);
		z-index: 10;
	}

	.mc-feature-col { padding: 14px 32px; }

	.mc-col {
		padding: 14px 0;
		text-align: center;
		font-size: 13px;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--clr-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mc-col.gold { color: var(--clr-gold); }
	.mc-col.blue { color: var(--clr-blue); }

	.matrix-section { border-bottom: 1px solid var(--clr-border); }
	.matrix-section:last-of-type { border-bottom: none; }

	.ms-title {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 32px 10px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
		background: rgba(255,255,255,0.015);
	}

	.ms-icon { font-size: 14px; }

	.ms-row {
		display: grid;
		grid-template-columns: 1fr 110px 110px 110px;
		border-top: 1px solid var(--clr-border);
		transition: background var(--duration-fast);
	}

	.ms-row:hover { background: rgba(255,255,255,0.02); }

	.ms-label {
		padding: 12px 32px;
		font-size: 13px;
		color: var(--clr-text-secondary);
		display: flex;
		align-items: center;
		gap: 8px;
		line-height: 1.4;
	}

	.ms-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px 8px;
		text-align: center;
	}

	.ms-cell.gold-col { background: rgba(240,165,0,0.02); }
	.ms-cell.blue-col { background: rgba(59,130,246,0.02); }

	.check {
		color: var(--clr-success);
		font-weight: 800;
		font-size: 14px;
	}

	.dash {
		color: var(--clr-text-muted);
		font-size: 16px;
	}

	.ms-val {
		font-size: 12px;
		font-weight: 600;
		color: var(--clr-text-secondary);
		font-family: var(--font-mono);
		text-align: center;
		line-height: 1.3;
	}

	.soon-pill {
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		background: rgba(59,130,246,0.1);
		color: var(--clr-blue);
		border: 1px solid rgba(59,130,246,0.2);
		white-space: nowrap;
	}

	.soon-pill-inline {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 8px;
		border-radius: var(--radius-full);
		background: rgba(59,130,246,0.1);
		color: var(--clr-blue);
		border: 1px solid rgba(59,130,246,0.2);
		vertical-align: middle;
	}

	.tooltip-wrap {
		font-size: 10px;
		color: var(--clr-text-muted);
		cursor: help;
		background: var(--clr-bg-elevated);
		border: 1px solid var(--clr-border);
		border-radius: 50%;
		width: 16px;
		height: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		position: relative;
	}

	.tooltip-wrap::after {
		content: attr(data-tip);
		position: absolute;
		left: 50%;
		bottom: calc(100% + 8px);
		transform: translateX(-50%);
		background: var(--clr-bg-elevated);
		color: var(--clr-text-primary);
		border: 1px solid var(--clr-border-light);
		border-radius: var(--radius-md);
		padding: 8px 12px;
		font-size: 11px;
		font-family: var(--font-sans);
		font-weight: 400;
		line-height: 1.5;
		white-space: nowrap;
		max-width: 240px;
		white-space: normal;
		text-align: left;
		box-shadow: var(--shadow-md);
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--duration-fast);
		z-index: 100;
	}

	.tooltip-wrap::before {
		content: '';
		position: absolute;
		left: 50%;
		bottom: calc(100% + 2px);
		transform: translateX(-50%);
		border: 5px solid transparent;
		border-top-color: var(--clr-border-light);
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--duration-fast);
		z-index: 100;
	}

	.tooltip-wrap:hover::after,
	.tooltip-wrap:hover::before {
		opacity: 1;
	}

	.matrix-cta-row {
		display: grid;
		grid-template-columns: 1fr 110px 110px 110px;
		border-top: 1px solid var(--clr-border);
		background: var(--clr-bg-elevated);
		padding: 16px 0;
	}

	/* ── Callout Cards ─────────────────────────────────── */
	.callout-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: var(--space-2xl);
	}

	.callout-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		padding: 24px;
		transition: all var(--duration-normal) var(--ease-out);
	}

	.callout-card:hover {
		border-color: var(--clr-border-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-sm);
	}

	.callout-icon { font-size: 28px; margin-bottom: 10px; }

	.callout-card h3 {
		font-size: 15px;
		font-weight: 700;
		margin-bottom: 8px;
	}

	.callout-card p {
		font-size: 12px;
		color: var(--clr-text-secondary);
		line-height: 1.6;
		margin-bottom: 14px;
	}

	.callout-plan {
		font-size: 10px;
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 3px 10px;
		border-radius: var(--radius-full);
	}

	.badge-gold-sm {
		background: var(--clr-gold-dim);
		color: var(--clr-gold);
		border: 1px solid rgba(240,165,0,0.2);
	}

	.badge-blue-sm {
		background: var(--clr-blue-dim);
		color: var(--clr-blue);
		border: 1px solid rgba(59,130,246,0.2);
	}

	/* ── FAQ ────────────────────────────────────────────── */
	.faq-wrap {
		max-width: 720px;
		margin: 0 auto var(--space-2xl);
	}

	.faq-list { display: flex; flex-direction: column; gap: 8px; }

	.faq-item {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: border-color var(--duration-fast);
	}

	.faq-item.open { border-color: var(--clr-border-light); }

	.faq-q {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 22px;
		background: none;
		border: none;
		color: var(--clr-text-primary);
		font-family: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		gap: 12px;
		transition: color var(--duration-fast);
	}

	.faq-q:hover { color: var(--clr-gold); }

	.faq-chevron {
		font-size: 20px;
		color: var(--clr-gold);
		flex-shrink: 0;
		font-weight: 300;
		line-height: 1;
	}

	.faq-a {
		padding: 0 22px 18px;
		font-size: 13px;
		color: var(--clr-text-secondary);
		line-height: 1.7;
	}

	/* ── Final CTA ──────────────────────────────────────── */
	.final-cta {
		margin-bottom: var(--space-2xl);
	}

	.final-cta-inner {
		background: linear-gradient(135deg, rgba(240,165,0,0.06), rgba(59,130,246,0.04));
		border: 1px solid var(--clr-border-light);
		border-radius: var(--radius-xl);
		padding: var(--space-2xl);
		text-align: center;
	}

	.final-cta-inner h2 { font-size: clamp(22px, 3vw, 32px); }

	.final-cta-btns {
		display: flex;
		gap: 12px;
		justify-content: center;
		margin-top: var(--space-lg);
		flex-wrap: wrap;
	}

	/* ── Responsive ─────────────────────────────────────── */
	@media (max-width: 960px) {
		.plan-grid { grid-template-columns: 1fr; max-width: 480px; margin-left: auto; margin-right: auto; }
		.callout-grid { grid-template-columns: 1fr 1fr; }
	}

	@media (max-width: 700px) {
		.matrix-cols-header { grid-template-columns: 1fr 80px 80px 80px; }
		.ms-row { grid-template-columns: 1fr 80px 80px 80px; }
		.matrix-cta-row { grid-template-columns: 1fr 80px 80px 80px; }
		.mc-feature-col, .ms-label { padding-left: var(--space-md); }
		.matrix-header-row { padding: 20px var(--space-md) 16px; }
		.ms-title { padding: 12px var(--space-md) 8px; }
		.ms-val { font-size: 11px; }
		.callout-grid { grid-template-columns: 1fr; }
	}

	@media (max-width: 480px) {
		.final-cta-btns { flex-direction: column; }
		.final-cta-btns .btn { width: 100%; }
		.matrix-cols-header { grid-template-columns: 1fr 70px 70px 70px; }
		.ms-row { grid-template-columns: 1fr 70px 70px 70px; }
		.matrix-cta-row { grid-template-columns: 1fr 70px 70px 70px; }
		.ms-label { font-size: 12px; padding-right: 8px; }
	}
</style>
