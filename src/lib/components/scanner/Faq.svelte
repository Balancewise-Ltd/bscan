<script lang="ts">
	const faqs = [
		{
			q: "What does BSCAN scan for?",
			a: "BSCAN runs 25+ checks across 6 categories: SEO, performance, accessibility, security, mobile-friendliness, and link health. You also get an AI-powered summary, tech stack detection, SSL grading, domain age, and industry benchmarking."
		},
		{
			q: "Is BSCAN really free?",
			a: "Yes — the free plan includes 3 scans per month, keyword research, Google Search Console integration, achievement badges, and the public leaderboard. No credit card required. Pro and Agency plans unlock more scans, competitor comparison, backlinks, monitoring, and API access."
		},
		{
			q: "How is BSCAN different from Lighthouse or PageSpeed Insights?",
			a: "Lighthouse only measures performance. BSCAN audits 6 categories at once, adds business intelligence (tech stack, competitor analysis, consumer sentiment), AI-generated fix suggestions with code snippets, and ongoing monitoring with email alerts — all in one tool."
		},
		{
			q: "Can I monitor my website automatically?",
			a: "Yes — Pro and Agency plans include automated site monitoring. BSCAN checks your site hourly and sends email and push notification alerts if your score drops below your chosen threshold."
		},
		{
			q: "Does BSCAN work with JavaScript-rendered sites?",
			a: "Agency plan scans use deep page rendering (Chromium-based) that fully executes JavaScript before auditing. Free and Pro scans use standard HTML fetching, which works for most sites."
		},
		{
			q: "Can I use BSCAN for client reports?",
			a: "Absolutely. Agency plan includes white-label PDF reports with your own brand name, colour, and logo. You can also use the BSCAN API to integrate auditing directly into your own tools or client dashboards."
		},
		{
			q: "What is the BSCAN Leaderboard?",
			a: "The Leaderboard is a public ranking of the top-scoring websites scanned by BSCAN. It's updated in real-time as users scan their sites — a great way to benchmark your site against others and show off your score."
		},
		{
			q: "How does the SEO keyword research tool work?",
			a: "BSCAN's keyword tool uses Google Autocomplete data to generate hundreds of keyword suggestions, question keywords, long-tail variations, and A-Z expansions — all completely free. Pro users also get backlink analysis powered by OpenLinkProfiler."
		}
	];

	let openIndex = $state<number | null>(null);

	function toggle(i: number) {
		openIndex = openIndex === i ? null : i;
	}

	// Build FAQ JSON-LD
	const faqJsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": faqs.map(f => ({
			"@type": "Question",
			"name": f.q,
			"acceptedAnswer": {
				"@type": "Answer",
				"text": f.a,
			}
		}))
	};
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>`}
</svelte:head>

<section class="faq" id="faq">
	<div class="faq-header">
		<span class="badge badge-blue">FAQ</span>
		<h2>Frequently Asked <span class="text-gold">Questions</span></h2>
	</div>

	<div class="faq-list">
		{#each faqs as faq, i}
			<button class="faq-item" class:open={openIndex === i} onclick={() => toggle(i)}>
				<div class="faq-q">
					<span>{faq.q}</span>
					<span class="faq-chevron">{openIndex === i ? '−' : '+'}</span>
				</div>
				{#if openIndex === i}
					<div class="faq-a">{faq.a}</div>
				{/if}
			</button>
		{/each}
	</div>
</section>

<style>
	.faq {
		padding: var(--space-2xl) 0 var(--space-xl);
		max-width: 720px;
		margin: 0 auto;
		padding-left: var(--space-lg);
		padding-right: var(--space-lg);
	}

	.faq-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.faq-header h2 {
		margin: var(--space-sm) 0;
		font-style: italic;
	}

	.faq-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.faq-item {
		width: 100%;
		text-align: left;
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		color: var(--clr-text-primary);
		transition: border-color var(--duration-fast);
	}

	.faq-item:hover {
		border-color: var(--clr-border-light);
	}

	.faq-item.open {
		border-color: var(--clr-blue);
	}

	.faq-q {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		font-size: 14px;
		font-weight: 600;
		gap: 16px;
	}

	.faq-chevron {
		font-size: 18px;
		color: var(--clr-text-muted);
		flex-shrink: 0;
		width: 24px;
		text-align: center;
	}

	.faq-a {
		padding: 0 20px 16px;
		font-size: 13px;
		color: var(--clr-text-secondary);
		line-height: 1.7;
	}
</style>
