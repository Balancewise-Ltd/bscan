<script lang="ts">
	import { ui } from '$lib/stores/ui';
	import { PLAN_PRICING } from '$lib/types';

	const interval = $derived($ui.billingInterval);
	const proPrice = $derived(PLAN_PRICING.pro[interval]);
	const agencyPrice = $derived(PLAN_PRICING.agency[interval]);
</script>

<section class="pricing" id="pricing">
	<div class="pricing-header">
		<span class="badge badge-gold">Pricing</span>
		<h2>Choose Your <span class="text-gold">Plan</span></h2>
		<p class="text-secondary" style="font-size: 14px;">Start free. Upgrade when you need more power.</p>

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
			>Annual <span class="save-tag">Save 20%</span></button>
		</div>
	</div>

	<div class="pricing-grid">
		<!-- Free -->
		<div class="plan-card">
			<div class="plan-name">Free</div>
			<div class="plan-price">£0</div>
			<div class="plan-period">forever</div>
			<p class="plan-desc">Perfect for quick checks and getting started.</p>
			<a href="#url-input" class="btn btn-outline" style="width:100%;">Start Scanning</a>

			<div class="plan-features">
				<div class="feat-group">Core</div>
				<div class="feat yes">3 scans per month</div>
				<div class="feat yes">6-category audit (25+ checks)</div>
				<div class="feat yes">AI chat assistant</div>
				<div class="feat yes">Basic AI summary</div>
				<div class="feat-group">SEO Tools</div>
				<div class="feat yes">Keyword research (unlimited)</div>
				<div class="feat yes">Google Search Console rankings</div>
				<div class="feat-group">Viral</div>
				<div class="feat yes">Achievement badges</div>
				<div class="feat yes">Challenge sharing</div>
				<div class="feat yes">Public leaderboard</div>
				<div class="feat-group">Locked</div>
				<div class="feat no">Competitor compare</div>
				<div class="feat no">Business intelligence</div>
				<div class="feat no">Lighthouse / Core Web Vitals</div>
				<div class="feat no">PDF export</div>
				<div class="feat no">Scan history</div>
			</div>
		</div>

		<!-- Pro -->
		<div class="plan-card featured">
			<div class="popular-tag">Most Popular</div>
			<div class="plan-name">Pro</div>
			<div class="plan-price">£{proPrice}</div>
			<div class="plan-period">per month{interval === 'annual' ? ' (billed annually)' : ''}</div>
			<p class="plan-desc">Full audit power for freelancers and small businesses.</p>
			<button class="btn btn-gold" style="width:100%;" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro</button>

			<div class="plan-features">
				<div class="feat-group">Everything in Free, plus:</div>
				<div class="feat yes">30 scans per month</div>
				<div class="feat yes">Core Web Vitals (LCP, CLS, TBT)</div>
				<div class="feat yes">Full site intelligence</div>
				<div class="feat yes">Advanced AI-powered summary</div>
				<div class="feat yes">Scan history dashboard</div>
				<div class="feat-group">Intelligence</div>
				<div class="feat yes">Backlink overview</div>
				<div class="feat yes">Competitor compare tool</div>
				<div class="feat yes">Business intelligence</div>
				<div class="feat yes">Consumer intelligence</div>
				<div class="feat yes">UX pattern detection</div>
				<div class="feat yes">Industry benchmarking</div>
				<div class="feat-group">Export</div>
				<div class="feat yes">PDF reports (branded)</div>
				<div class="feat yes">Email reports</div>
			</div>
		</div>

		<!-- Agency -->
		<div class="plan-card">
			<div class="plan-name">Agency</div>
			<div class="plan-price">£{agencyPrice}</div>
			<div class="plan-period">per month{interval === 'annual' ? ' (billed annually)' : ''}</div>
			<p class="plan-desc">For agencies and teams managing multiple client sites.</p>
			<button class="btn btn-blue" style="width:100%;" onclick={() => ui.openCheckout('agency')}>Go Agency</button>

			<div class="plan-features">
				<div class="feat-group">Everything in Pro, plus:</div>
				<div class="feat yes">Unlimited scans</div>
				<div class="feat yes">Deep page rendering (JS apps)</div>
				<div class="feat yes">AI SEO strategy</div>
				<div class="feat-group">Team & API</div>
				<div class="feat yes">5 team members</div>
				<div class="feat yes">5 API keys</div>
				<div class="feat yes">Team management dashboard</div>
				<div class="feat-group">Export</div>
				<div class="feat yes">White-label PDF reports</div>
				<div class="feat yes">Custom branding on exports</div>
				<div class="feat-group">Priority</div>
				<div class="feat yes">Priority support</div>
				<div class="feat yes">Early access to new features</div>
			</div>
		</div>
	</div>
</section>

<style>
	.pricing {
		padding: var(--space-2xl) 0 var(--space-xl);
		max-width: var(--max-width);
		margin: 0 auto;
		padding-left: var(--space-lg);
		padding-right: var(--space-lg);
	}

	.pricing-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.pricing-header h2 {
		margin: var(--space-sm) 0;
		font-style: italic;
	}

	.billing-toggle {
		display: inline-flex;
		margin-top: var(--space-md);
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 3px;
	}

	.toggle-btn {
		padding: 8px 20px;
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

	.toggle-btn.active {
		background: var(--clr-blue);
		color: white;
	}

	.save-tag {
		color: var(--clr-success);
		font-size: 10px;
	}

	.pricing-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--space-md);
		align-items: start;
	}

	.plan-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		position: relative;
		transition: all var(--duration-normal) var(--ease-out);
	}

	.plan-card:hover {
		border-color: var(--clr-border-light);
		transform: translateY(-2px);
	}

	.plan-card.featured {
		border-color: var(--clr-gold);
		box-shadow: var(--shadow-glow-gold);
	}

	.popular-tag {
		position: absolute;
		top: -10px;
		left: 50%;
		transform: translateX(-50%);
		padding: 4px 16px;
		background: var(--clr-gold);
		color: var(--clr-bg-deep);
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 700;
	}

	.plan-name {
		font-size: 16px;
		font-weight: 700;
		margin-bottom: 4px;
	}

	.plan-price {
		font-size: 36px;
		font-weight: 800;
		letter-spacing: -2px;
	}

	.plan-period {
		font-size: 12px;
		color: var(--clr-text-muted);
		margin-bottom: var(--space-md);
	}

	.plan-desc {
		font-size: 13px;
		color: var(--clr-text-secondary);
		margin-bottom: var(--space-md);
		line-height: 1.5;
	}

	.plan-features {
		margin-top: var(--space-lg);
	}

	.feat-group {
		font-size: 10px;
		font-weight: 700;
		color: var(--clr-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-family: var(--font-mono);
		margin-top: var(--space-md);
		margin-bottom: var(--space-xs);
	}

	.feat {
		font-size: 12px;
		padding: 4px 0;
		color: var(--clr-text-secondary);
	}

	.feat.yes::before {
		content: '✓ ';
		color: var(--clr-success);
		font-weight: 700;
	}

	.feat.no {
		color: var(--clr-text-muted);
		opacity: 0.6;
	}

	.feat.no::before {
		content: '— ';
	}
</style>
