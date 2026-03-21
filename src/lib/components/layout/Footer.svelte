<footer class="footer">
	<div class="footer-inner">
		<div class="footer-grid">
			<div class="footer-col">
				<div class="footer-brand">BSCAN</div>
				<p class="footer-desc">Free website audit tool by Balancewise Technologies. Scan any URL for SEO, performance, accessibility, and security issues.</p>
			</div>
			<div class="footer-col">
				<div class="footer-heading">Tools</div>
				<a href="/">Website Scanner</a>
				<a href="/seo">SEO Dashboard</a>
				<a href="/compare">Compare Websites</a>
				<a href="/deep-crawl">Deep Crawl</a>
				<a href="/monitoring">Site Monitoring</a>
			</div>
			<div class="footer-col">
				<div class="footer-heading">Platform</div>
				<a href="/leaderboard">Leaderboard</a>
			<a href="/account" style="color: var(--clr-gold);">Refer Friends</a>
				<a href="/api-docs">API Documentation</a>
				<a href="/account">My Account</a>
				<a href="/team">Team Management</a>
			</div>
			<div class="footer-col">
				<div class="footer-heading">Company</div>
				<a href="https://balancewises.io" target="_blank" rel="noopener">Balancewise Technologies</a>
				<a href="https://balancewises.io/privacy" target="_blank" rel="noopener">Privacy Policy</a>
				<a href="https://balancewises.io/terms" target="_blank" rel="noopener">Terms of Service</a>
				<a href="https://github.com/Balancewise-Ltd" target="_blank" rel="noopener">GitHub</a>
			</div>
		</div>
		<div class="footer-bottom">
			<span>© {new Date().getFullYear()} Balancewise Ltd (No. 16164776) · All rights reserved</span>
		</div>
	</div>
</footer>

<style>
	.footer {
		border-top: 1px solid var(--clr-border);
		padding: var(--space-2xl) var(--space-xl) var(--space-lg);
		margin-top: var(--space-2xl);
	}

	.footer-inner {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.footer-grid {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr 1fr;
		gap: var(--space-xl);
		margin-bottom: var(--space-xl);
	}

	.footer-brand {
		font-size: 18px;
		font-weight: 800;
		font-style: italic;
		color: var(--clr-gold);
		margin-bottom: 8px;
	}

	.footer-desc {
		font-size: 12px;
		color: var(--clr-text-muted);
		line-height: 1.6;
		max-width: 280px;
	}

	.footer-heading {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--clr-text-secondary);
		margin-bottom: 12px;
		font-family: var(--font-mono);
	}

	.footer-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.footer-col a {
		font-size: 13px;
		color: var(--clr-text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.footer-col a:hover {
		color: var(--clr-text-primary);
	}

	.footer-bottom {
		padding-top: var(--space-lg);
		border-top: 1px solid var(--clr-border);
		font-size: 11px;
		color: var(--clr-text-muted);
	}

	@media (max-width: 768px) {
		.footer {
			padding: var(--space-xl) var(--space-md) var(--space-md);
		}
		.footer-grid {
			grid-template-columns: 1fr 1fr;
			gap: var(--space-lg);
		}
	}

	@media (max-width: 480px) {
		.footer-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
