<footer class="footer">
	<div class="footer-inner">
		<div class="footer-left">
			BSCAN by <a href="https://balancewises.io">Balancewise Technologies</a> · © 2026 Balancewise Ltd
		</div>
		<div class="footer-right">
			<a href="https://balancewises.io/privacy">Privacy</a>
			<a href="https://balancewises.io/terms">Terms</a>
			<a href="/leaderboard">Leaderboard</a>
			<a href="https://github.com/Balancewise-Ltd" target="_blank" rel="noopener">GitHub</a>
		</div>
	</div>
</footer>

<style>
	.footer {
		border-top: 1px solid var(--clr-border);
		padding: var(--space-lg) var(--space-xl);
		margin-top: var(--space-2xl);
	}

	.footer-inner {
		max-width: var(--max-width);
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-md);
	}

	.footer-left {
		font-size: 12px;
		color: var(--clr-text-muted);
	}

	.footer-left a {
		color: var(--clr-text-secondary);
	}

	.footer-right {
		display: flex;
		gap: var(--space-md);
	}

	.footer-right a {
		font-size: 12px;
		color: var(--clr-text-muted);
	}

	.footer-right a:hover {
		color: var(--clr-text-secondary);
	}

	@media (max-width: 640px) {
		.footer {
			padding: var(--space-lg) var(--space-md);
		}
		.footer-inner {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
