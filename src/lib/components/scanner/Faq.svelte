<script lang="ts">
	const faqs = [
		{
			q: "What does BSCAN scan for?",
			a: "BSCAN runs 25+ checks across 6 categories: SEO, performance, accessibility, security, mobile-friendliness, and link health. You also get an AI-powered summary, tech stack detection, SSL grading, domain age, and industry benchmarking — all from a single URL."
		},
		{
			q: "Is BSCAN really free?",
			a: "Yes — the free plan includes 3 scans per month, unlimited keyword research, Google Search Console integration, achievement badges, and the public leaderboard. No credit card required. Pro and Agency plans unlock more scans, competitor comparison, backlinks, monitoring, and API access."
		},
		{
			q: "How is BSCAN different from Lighthouse or PageSpeed Insights?",
			a: "Lighthouse only measures performance. BSCAN audits 6 categories at once, adds business intelligence (tech stack, competitor analysis, consumer sentiment), AI-generated fix suggestions with code snippets, and ongoing monitoring with email alerts — all in one tool."
		},
		{
			q: "How does the Compare tool work?",
			a: "Enter two URLs and BSCAN scans both sites simultaneously, then gives you a side-by-side breakdown across all 6 categories. You'll see who wins in SEO, performance, security, and more — plus up to 24 actionable insights like 'Site A has live chat but Site B doesn't' or 'Site B loads 2x faster'. Perfect for competitive analysis or pitching to clients."
		},
		{
			q: "Can I monitor my website automatically?",
			a: "Yes — Pro and Agency plans include automated site monitoring. BSCAN checks your site every hour and sends email and push notification alerts if your score drops below your chosen threshold. You'll also see trend charts tracking your score over time, so you can spot issues before they affect your users."
		},
		{
			q: "How does the Team feature work?",
			a: "Agency plan includes team management for up to 5 members. Invite colleagues by email — they get full Agency access automatically. You can share team notes on scans, see an activity feed of who scanned what, and collaborate on audits. Perfect for agencies managing multiple client sites across a team."
		},
		{
			q: "Why should agencies and freelancers use BSCAN?",
			a: "Agencies use BSCAN to win clients and keep them. Run a free scan on a prospect's site, show them the issues, then offer to fix them. Deep Crawl audits up to 50 pages at once. White-label PDF reports let you brand them as your own. The Compare tool shows clients exactly where they're losing to competitors. API access lets you build BSCAN into your own tools."
		},
		{
			q: "What is the BSCAN Leaderboard?",
			a: "The Leaderboard is a public ranking of the top-scoring websites scanned by BSCAN. It updates in real-time as users scan their sites. It's a great way to benchmark against others, show off your score, and create healthy competition. Can your site make the top 10?"
		},
		{
			q: "What are Achievement Badges?",
			a: "Every scan earns achievements based on your results — like 'Speed Demon' for fast load times, 'Fort Knox' for perfect security, or 'Perfect 100' for a flawless score. You get embeddable SVG badges to display on your website, plus shareable challenge URLs to invite others to beat your score."
		},
		{
			q: "How does the SEO keyword research tool work?",
			a: "BSCAN's keyword tool uses Google Autocomplete data to generate hundreds of keyword suggestions, question keywords, long-tail variations, and A-Z expansions — all completely free. You can also connect your Google Search Console to see real keyword positions, clicks, impressions, and quick win opportunities."
		},
		{
			q: "What is Deep Crawl?",
			a: "Deep Crawl is an Agency feature that audits your entire site, not just one page. Enter your homepage and BSCAN crawls up to 50 internal pages, running a full 6-category audit on each one. You get average scores, total issues found, worst and best pages, and a downloadable PDF report. The AI Fix Generator gives you code snippets for every issue."
		},
		{
			q: "Does BSCAN work with JavaScript-rendered sites?",
			a: "Agency plan scans use deep page rendering (Chromium-based) that fully executes JavaScript before auditing. This means React, Next.js, Vue, and Angular sites get accurate results. Free and Pro scans use standard HTML fetching, which works for most traditional sites."
		},
		{
			q: "Can I use BSCAN for client reports?",
			a: "Absolutely. Agency plan includes white-label PDF reports with your own brand name, colour, and logo. Export professional reports for any scan or deep crawl. You can also use the BSCAN API to generate reports programmatically and integrate auditing into your own client dashboard."
		},
		{
			q: "What does the AI Fix Generator do?",
			a: "Click the AI Fix button on any issue and BSCAN generates a tailored fix — including a summary, priority level, effort estimate, and actual code snippets with filenames. It tells you exactly what to change and where. Powered by Llama 3.3 70B, it understands HTML, CSS, JavaScript, meta tags, headers, and server configuration."
		},
		{
			q: "How does BSCAN detect business and consumer intelligence?",
			a: "BSCAN analyses over 100 signals including payment methods, social proof, email capture, urgency tactics, live chat tools, review platforms, loyalty programmes, pricing psychology, delivery options, and more. It's like having a marketing analyst review your competitor's entire website in seconds."
		},
		{
			q: "What plans are available and how much do they cost?",
			a: "Free: £0 forever — 3 scans/month, keyword research, GSC integration. Pro: £9/month — 30 scans, compare tool, monitoring, PDF exports, business intelligence. Agency: £29/month — unlimited scans, deep crawl, team management, API access, white-label reports, AI fix generator. Annual billing saves 20%."
		}
	];

	let openIndex = $state<number | null>(null);

	function toggle(i: number) {
		openIndex = openIndex === i ? null : i;
	}

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
