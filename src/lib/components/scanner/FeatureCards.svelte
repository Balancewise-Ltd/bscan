<script lang="ts">
	import { sanitize } from '$lib/utils/security';
	import type { ScanResult, BusinessIntel, ConsumerIntel, Benchmarks } from '$lib/types';

	interface Props {
		scanData: ScanResult;
		isPaid: boolean;
	}

	let { scanData, isPaid }: Props = $props();

	let openPanel = $state<string | null>(null);

	function toggle(key: string) {
		openPanel = openPanel === key ? null : key;
	}

	// ── Feature card definitions ──────────────────────────
	const bi = $derived<BusinessIntel>(scanData.business_intel || {});
	const ci = $derived<ConsumerIntel>(scanData.consumer_intel || {});
	const bench = $derived<Benchmarks>(scanData.benchmarks || {});
	const ux = $derived<NonNullable<Benchmarks['ux_patterns']>>(bench?.ux_patterns || {} as NonNullable<Benchmarks['ux_patterns']>);
	const industry = $derived<NonNullable<Benchmarks['industry']>>(bench?.industry || {} as NonNullable<Benchmarks['industry']>);
	const kw = $derived<NonNullable<BusinessIntel['keywords']>>(bi?.keywords || {} as NonNullable<BusinessIntel['keywords']>);

	const features = $derived([
		{
			key: 'business_intel', icon: '💼', label: 'Business Intel', free: false,
			count: (bi?.ctas?.total_ctas || 0) + (bi?.payment_methods?.methods?.length || 0) + (bi?.social_media?.count || 0),
			sub: 'CTAs, payments, social'
		},
		{
			key: 'consumer_intel', icon: '🛍️', label: 'Consumer Intel', free: false,
			count: ci?.trust_signals?.count || 0,
			sub: `Trust: ${ci?.trust_signals?.count || 0} · Support: ${ci?.customer_support?.score || 0}/100`
		},
		{
			key: 'ux_patterns', icon: '🎨', label: 'UX Patterns', free: false,
			count: ux?.total_detected || 0,
			sub: `${ux?.ux_score || 0}/100 UX score`
		},
		{
			key: 'keywords', icon: '🔍', label: 'Keywords', free: true,
			count: kw?.top_words?.length || 0,
			sub: (kw?.top_words || []).slice(0, 3).join(', ') || 'Run scan first'
		},
		{
			key: 'benchmarks', icon: '📊', label: 'Industry Rank', free: false,
			count: industry?.detected_industry ? 1 : 0,
			sub: industry?.industry_label || 'Not detected'
		}
	]);
</script>

<!-- Feature Cards Grid -->
<div class="feat-grid">
	{#each features as feat}
		{@const isLocked = !isPaid && !feat.free}
		<button
			class="feat-card"
			class:locked={isLocked}
			type="button"
			onclick={() => toggle(feat.key)}
		>
			<div class="feat-icon">{feat.icon}</div>
			<div class="feat-count">{feat.count || '—'}</div>
			<div class="feat-label">{feat.label}</div>
			<div class="feat-sub">{feat.sub}</div>
			{#if isLocked}
				<div class="feat-lock">🔒 Pro</div>
			{:else}
				<div class="feat-tap">tap for details →</div>
			{/if}
		</button>
	{/each}
</div>

<!-- ── Detail Panels ──────────────────────────────────── -->
{#if openPanel}
	{@const isLocked = !isPaid && openPanel !== 'keywords'}
	<div class="feat-panel animate-fade-up">
		<div class="panel-header">
			<div class="panel-title">
				{features.find(f => f.key === openPanel)?.icon}
				{features.find(f => f.key === openPanel)?.label}
			</div>
			<button class="btn btn-outline btn-sm" onclick={() => openPanel = null}>Close ✕</button>
		</div>
		<div class="panel-body">

			{#if isLocked}
				<!-- Upgrade CTA -->
				<div class="panel-upgrade">
					<div style="font-size: 32px; margin-bottom: 10px;">{features.find(f => f.key === openPanel)?.icon}</div>
					<h3>{features.find(f => f.key === openPanel)?.label}</h3>
					{#if openPanel === 'business_intel'}
						<p>See how this website drives revenue: payment methods, CTAs, email capture, urgency tactics, social proof, live chat, conversion tools.</p>
					{:else if openPanel === 'consumer_intel'}
						<p>Understand the customer experience: reviews, support channels, trust signals, loyalty programs, delivery, pricing psychology, personalization.</p>
					{:else if openPanel === 'ux_patterns'}
						<p>30+ UX patterns detected across navigation, product pages, conversion, mobile, content, and trust categories.</p>
					{:else if openPanel === 'benchmarks'}
						<p>See how this site ranks against others in its industry. Percentile scores, industry averages, and recommendations.</p>
					{/if}
					<a href="/pricing" class="btn btn-gold" style="margin-top: 16px;">Upgrade to Starter — £9/mo</a>
				</div>

			{:else if openPanel === 'business_intel'}
				<!-- Business Intelligence -->
				{@const sections = [
					{ key: 'ctas', icon: '🎯', title: 'CTAs', render: (d: any) => `Total: ${d?.total_ctas || 0} · Purchase: ${(d?.purchase_ctas || []).length} · Signup: ${(d?.signup_ctas || []).length}` },
					{ key: 'payment_methods', icon: '💳', title: 'Payment Methods', render: (d: any) => (d?.methods || []).join(', ') || 'None detected' },
					{ key: 'social_proof', icon: '⭐', title: 'Social Proof', render: (d: any) => `Score: ${d?.score || 0} · ${(d?.signals || []).join(', ') || 'None'}` },
					{ key: 'email_capture', icon: '✉️', title: 'Email Capture', render: (d: any) => (d?.methods || []).join(', ') || 'None' },
					{ key: 'urgency_tactics', icon: '⏰', title: 'Urgency Tactics', render: (d: any) => (d?.tactics || []).join(', ') || 'None' },
					{ key: 'social_media', icon: '📱', title: 'Social Media', render: (d: any) => Object.keys(d?.platforms || {}).join(', ') || 'None linked' },
					{ key: 'live_chat', icon: '💬', title: 'Live Chat', render: (d: any) => d?.has_live_chat ? (d?.tools || []).join(', ') : 'Not detected' },
					{ key: 'pricing', icon: '💰', title: 'Pricing', render: (d: any) => d?.prices_found ? `${d.prices_found} prices · ${d?.currency || ''} ${d?.price_range || ''}` : 'No prices found' }
				]}
				{#each sections as sec}
					<div class="detail-row">
						<span class="detail-icon">{sec.icon}</span>
						<div>
							<strong>{sec.title}</strong><br>
							<span class="text-secondary">{sanitize(sec.render((bi as Record<string, any>)[sec.key]))}</span>
						</div>
					</div>
				{/each}

			{:else if openPanel === 'consumer_intel'}
				<!-- Consumer Intelligence -->
				{@const sections = [
					{ key: 'reviews_ratings', icon: '⭐', title: 'Reviews', render: (d: any) => d?.has_reviews ? `Found · Platforms: ${(d?.review_platforms || []).join(', ')}${d?.star_rating ? ` · ${d.star_rating} stars` : ''}` : 'No reviews detected' },
					{ key: 'customer_support', icon: '🎧', title: 'Support', render: (d: any) => `Score: ${d?.score || 0}/100 · Channels: ${(d?.channels || []).join(', ') || 'None'}` },
					{ key: 'trust_signals', icon: '🛡️', title: 'Trust Signals', render: (d: any) => `${d?.count || 0} found: ${(d?.signals || []).slice(0, 4).join(', ') || 'None'}` },
					{ key: 'loyalty_program', icon: '🎁', title: 'Loyalty', render: (d: any) => d?.has_loyalty_program ? (d?.program_type || []).join(', ') : 'Not detected' },
					{ key: 'pricing_psychology', icon: '💰', title: 'Pricing Tactics', render: (d: any) => `${d?.count || 0} tactics · ${d?.sophistication || 'None'}: ${(d?.tactics || []).slice(0, 3).join(', ')}` },
					{ key: 'delivery_shipping', icon: '🚚', title: 'Delivery', render: (d: any) => (d?.signals || []).join(', ') || 'No delivery info' },
					{ key: 'personalization', icon: '🎯', title: 'Personalization', render: (d: any) => `${d?.sophistication || 'None'}: ${(d?.features || []).join(', ') || 'None detected'}` },
					{ key: 'return_policy', icon: '↩️', title: 'Returns', render: (d: any) => d?.has_return_policy ? (d?.signals || []).join(', ') : 'No return policy found' }
				]}
				{#each sections as sec}
					<div class="detail-row">
						<span class="detail-icon">{sec.icon}</span>
						<div>
							<strong>{sec.title}</strong><br>
							<span class="text-secondary">{sanitize(sec.render((ci as Record<string, any>)[sec.key]))}</span>
						</div>
					</div>
				{/each}

			{:else if openPanel === 'ux_patterns'}
				<!-- UX Patterns -->
				<div style="text-align: center; margin-bottom: 16px;">
					<div style="font-size: 32px; font-weight: 800; color: #06b6d4;">
						{ux?.ux_score || 0}<span style="font-size: 16px; color: var(--clr-text-muted);">/100</span>
					</div>
					<div class="text-muted" style="font-size: 12px;">{ux?.total_detected || 0} patterns detected</div>
				</div>
				{#if ux?.all_patterns?.length}
					<div class="ux-tags">
						{#each ux.all_patterns as p}
							{@const name = typeof p === 'string' ? p : (p.name || p.pattern || 'Unknown')}
							<span class="ux-tag">{sanitize(name)}</span>
						{/each}
					</div>
				{/if}

			{:else if openPanel === 'keywords'}
				<!-- Keywords -->
				{#if kw?.h1_headings?.length}
					<div class="kw-group-title">H1 HEADINGS</div>
					{#each kw.h1_headings as heading}
						<div class="kw-heading">"{sanitize(heading)}"</div>
					{/each}
				{/if}
				{#if kw?.top_words?.length}
					<div class="kw-group-title" style="margin-top: 12px;">TOP KEYWORDS</div>
					<div class="ux-tags">
						{#each kw.top_words as w}
							{@const word = typeof w === 'string' ? w : ((w as any).word || w)}
							<span class="kw-word-tag">{sanitize(word)}</span>
						{/each}
					</div>
				{/if}
				<div style="margin-top: 16px; text-align: center;">
					<a href="/seo" class="btn btn-blue btn-sm">Full Keyword Research →</a>
				</div>

			{:else if openPanel === 'benchmarks'}
				<!-- Industry Benchmarks -->
				{#if industry?.industry_label}
					<div style="text-align: center; margin-bottom: 16px;">
						<div class="text-muted" style="font-size: 14px; margin-bottom: 4px;">Detected Industry</div>
						<div style="font-size: 22px; font-weight: 800; color: var(--clr-gold);">{sanitize(industry.industry_label)}</div>
					</div>
				{/if}
				{#if industry?.comparisons}
					<div class="bench-title">VS INDUSTRY AVERAGE</div>
					{#each Object.entries(industry.comparisons) as [cat, data]}
						{@const d = data as any}
						{@const score = d?.your_score ?? d?.score ?? 0}
						{@const diff = score - (d?.industry_avg || 0)}
						<div class="bench-row">
							<span class="text-secondary" style="text-transform: capitalize;">{cat}</span>
							<span>
								<strong>{score}</strong>
								<span class="text-muted">vs</span> {d?.industry_avg || 0}
								<span style="color: {diff >= 0 ? 'var(--clr-success)' : 'var(--clr-danger)'}; font-weight: 700;">
									({diff >= 0 ? '+' : ''}{diff})
								</span>
							</span>
						</div>
					{/each}
				{/if}
				{#if industry?.summary}
					<div class="bench-summary">{sanitize(industry.summary)}</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ── Feature Cards Grid ────────────── */
	.feat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
		gap: 12px;
		margin-bottom: var(--space-lg);
	}

	.feat-card {
		background: var(--clr-bg-card);
		border: 1px dashed var(--clr-border-light);
		border-radius: var(--radius-lg);
		padding: 18px;
		text-align: center;
		cursor: pointer;
		transition: all var(--duration-normal) var(--ease-out);
		font-family: inherit;
		color: inherit;
		width: 100%;
	}

	.feat-card:hover {
		border-color: var(--clr-border-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
		border-style: solid;
	}

	.feat-card.locked { opacity: 0.7; }

	.feat-icon { font-size: 24px; margin-bottom: 6px; }

	.feat-count {
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -1px;
		color: var(--clr-text-primary);
	}

	.feat-label {
		font-size: 12px;
		color: var(--clr-text-secondary);
		font-weight: 500;
	}

	.feat-sub {
		font-size: 10px;
		color: var(--clr-text-muted);
		margin-top: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--clr-border);
	}

	.feat-lock {
		font-size: 10px;
		color: var(--clr-gold);
		font-family: var(--font-mono);
		margin-top: 4px;
	}

	.feat-tap {
		font-size: 9px;
		color: var(--clr-text-muted);
		opacity: 0.5;
		font-family: var(--font-mono);
		margin-top: 4px;
	}

	/* ── Panel ─────────────────────────── */
	.feat-panel {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border-light);
		border-radius: var(--radius-xl);
		margin-bottom: var(--space-lg);
		overflow: hidden;
	}

	.panel-header {
		padding: 18px 22px;
		border-bottom: 1px solid var(--clr-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title { font-size: 16px; font-weight: 700; }
	.panel-body { padding: 18px 22px; }

	.panel-upgrade {
		text-align: center;
		padding: var(--space-lg);
		background: linear-gradient(135deg, rgba(240,165,0,0.06), rgba(59,130,246,0.04));
		border-radius: var(--radius-md);
	}

	.panel-upgrade h3 { font-size: 16px; margin-bottom: 6px; }
	.panel-upgrade p { font-size: 12px; color: var(--clr-text-secondary); line-height: 1.6; max-width: 380px; margin: 0 auto; }

	/* ── Detail Rows ──────────────────── */
	.detail-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--clr-border);
		font-size: 12px;
	}

	.detail-row:last-child { border-bottom: none; }
	.detail-icon { font-size: 16px; width: 28px; text-align: center; flex-shrink: 0; padding-top: 2px; }

	/* ── UX Tags ──────────────────────── */
	.ux-tags { display: flex; flex-wrap: wrap; gap: 6px; }

	.ux-tag {
		font-size: 11px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: rgba(6, 182, 212, 0.08);
		border: 1px solid rgba(6, 182, 212, 0.15);
		color: #06b6d4;
		font-family: var(--font-mono);
	}

	/* ── Keywords ─────────────────────── */
	.kw-group-title {
		font-size: 11px;
		font-weight: 700;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
		margin-bottom: 6px;
	}

	.kw-heading {
		font-size: 13px;
		color: var(--clr-text-primary);
		padding: 4px 0;
	}

	.kw-word-tag {
		font-size: 11px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: var(--clr-bg-primary);
		border: 1px solid var(--clr-border);
		color: var(--clr-text-secondary);
		font-family: var(--font-mono);
	}

	/* ── Benchmarks ───────────────────── */
	.bench-title {
		font-size: 11px;
		font-weight: 700;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
		margin-bottom: 8px;
	}

	.bench-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid var(--clr-border);
		font-size: 12px;
	}

	.bench-row:last-child { border-bottom: none; }

	.bench-summary {
		margin-top: 12px;
		padding: 12px;
		background: var(--clr-bg-primary);
		border-radius: var(--radius-md);
		font-size: 12px;
		color: var(--clr-text-secondary);
		line-height: 1.6;
		border-left: 3px solid var(--clr-gold);
	}

	@media (max-width: 640px) {
		.feat-grid { grid-template-columns: repeat(2, 1fr); }
	}
</style>
