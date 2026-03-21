<script lang="ts">
	const faqs = [
		{ q: "What does BSCAN scan for?", a: "25+ checks across SEO, performance, accessibility, security, mobile, and links — plus AI summary, tech stack detection, SSL grading, and industry benchmarking." },
		{ q: "Is BSCAN really free?", a: "Yes — 3 scans/month, unlimited keyword research, Google Search Console integration, and the public leaderboard. No credit card required." },
		{ q: "How does the Compare tool work?", a: "Enter two URLs and get a side-by-side breakdown across all 6 categories with up to 24 actionable insights. Perfect for competitive analysis." },
		{ q: "Can I monitor my website automatically?", a: "Pro and Agency plans include hourly monitoring with email and push alerts when your score drops below your threshold." },
		{ q: "How is BSCAN different from Lighthouse?", a: "Lighthouse only measures performance. BSCAN audits 6 categories, adds business intelligence, AI fix suggestions, and ongoing monitoring — all in one tool." },
		{ q: "How does the Team feature work?", a: "Agency plan lets you invite up to 5 members. Share notes, see activity feeds, and collaborate on audits across your team." },
		{ q: "Why should agencies use BSCAN?", a: "Deep Crawl audits 50 pages at once. White-label PDFs carry your brand. The Compare tool wins pitches. API access integrates into your workflow." },
		{ q: "What are Achievement Badges?", a: "Every scan earns achievements like 'Speed Demon' or 'Fort Knox'. Get embeddable SVG badges and shareable challenge URLs." },
		{ q: "How does keyword research work?", a: "Google Autocomplete data generates hundreds of suggestions, questions, and long-tail keywords — completely free. Connect GSC for real position data." },
		{ q: "What is Deep Crawl?", a: "Agency feature that audits up to 50 internal pages at once. Get average scores, worst pages, and a downloadable PDF report with AI fix suggestions." },
		{ q: "Does BSCAN work with JS-rendered sites?", a: "Agency plan uses Chromium-based deep rendering. React, Next.js, Vue, and Angular sites get accurate results." },
		{ q: "Can I use BSCAN for client reports?", a: "Agency plan includes white-label PDF reports with your brand name, colour, and logo. Also available via API." },
		{ q: "What does the AI Fix Generator do?", a: "Click AI Fix on any issue to get a tailored fix with code snippets, priority level, and effort estimate." },
		{ q: "How does business intelligence work?", a: "BSCAN analyses 100+ signals: payment methods, social proof, email capture, live chat, pricing psychology, and more." },
		{ q: "What plans are available?", a: "Free: £0 (3 scans). Pro: £9/mo (30 scans, compare, monitoring). Agency: £29/mo (unlimited, deep crawl, team, API). Annual saves 20%." },
		{ q: "What is the referral programme?", a: "Refer 3 friends who verify their email and earn 1 month of Pro free. Share your unique link from your account dashboard." }
	];

	let openIndex = $state<number | null>(null);
	let showAll = $state(false);

	function toggle(i: number) {
		openIndex = openIndex === i ? null : i;
	}

	const visible = $derived(showAll ? faqs : faqs.slice(0, 4));

	const faqJsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": faqs.map(f => ({
			"@type": "Question",
			"name": f.q,
			"acceptedAnswer": { "@type": "Answer", "text": f.a }
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
		{#each visible as faq, i}
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

	{#if !showAll}
		<div style="text-align: center; margin-top: 16px;">
			<button class="see-more" onclick={() => showAll = true}>
				See all {faqs.length} questions ↓
			</button>
		</div>
	{:else}
		<div style="text-align: center; margin-top: 16px;">
			<button class="see-more" onclick={() => { showAll = false; openIndex = null; }}>
				Show less ↑
			</button>
		</div>
	{/if}
</section>

<style>
	.faq {
		padding: var(--space-xl) 0;
		max-width: 720px;
		margin: 0 auto;
		padding-left: var(--space-lg);
		padding-right: var(--space-lg);
	}

	.faq-header {
		text-align: center;
		margin-bottom: var(--space-lg);
	}

	.faq-header h2 {
		margin: var(--space-sm) 0;
		font-style: italic;
		font-size: 20px;
	}

	.faq-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.faq-item {
		width: 100%;
		text-align: left;
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		color: var(--clr-text-primary);
		transition: border-color var(--duration-fast);
	}

	.faq-item:hover { border-color: var(--clr-border-light); }
	.faq-item.open { border-color: var(--clr-blue); }

	.faq-q {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		font-size: 13px;
		font-weight: 600;
		gap: 12px;
	}

	.faq-chevron {
		font-size: 16px;
		color: var(--clr-text-muted);
		flex-shrink: 0;
		width: 20px;
		text-align: center;
	}

	.faq-a {
		padding: 0 16px 14px;
		font-size: 12px;
		color: var(--clr-text-secondary);
		line-height: 1.7;
	}

	.see-more {
		background: none;
		border: none;
		color: var(--clr-blue);
		font-family: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		padding: 8px 16px;
		border-radius: var(--radius-md);
		transition: background var(--duration-fast);
	}

	.see-more:hover { background: var(--clr-blue-dim); }
</style>
