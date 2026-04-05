<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import Seo from '$lib/components/ui/Seo.svelte';
</script>

<Seo
	title="API Documentation — BSCAN REST API"
	description="BSCAN REST API documentation. Integrate website auditing into your applications. Scan URLs, get scores, retrieve issues programmatically."
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "TechArticle",
		"headline": "BSCAN API Documentation",
		"url": "https://bscan.balancewises.io/api-docs",
		"description": "RESTful API for website auditing. Endpoints for scanning URLs, retrieving scores, managing API keys, and bulk operations.",
		"author": { "@type": "Organization", "name": "Balancewise Technologies", "url": "https://balancewises.io" }
	}}
/>

<div class="container" style="max-width: 800px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-blue">🔌 API</span>
		<h1>API <span class="text-gold">Documentation</span></h1>
		<p class="text-secondary">Programmatic access to BSCAN's website audit engine.</p>
	</div>

	<div class="api-content animate-fade-up">
		<!-- Base URL -->
		<div class="card" style="margin-bottom: 20px;">
			<div class="card-header">
				<span>🌐</span>
				<span style="font-weight: 700;">Base URL</span>
			</div>
			<div class="card-body">
				<code class="code-block">https://api-bscan.balancewises.io</code>
			</div>
		</div>

		<!-- Authentication -->
		<div class="card" style="margin-bottom: 20px;">
			<div class="card-header">
				<span>🔑</span>
				<span style="font-weight: 700;">Authentication</span>
			</div>
			<div class="card-body">
				<p class="text-secondary" style="margin-bottom: 12px;">All authenticated endpoints require a Bearer token in the Authorization header.</p>
				<code class="code-block">Authorization: Bearer YOUR_API_KEY</code>
				<p class="text-muted" style="margin-top: 12px; font-size: 12px;">API keys are available on Pro and Agency plans. Manage yours in the <a href="/account">Account dashboard</a>.</p>
			</div>
		</div>

		<!-- Endpoints -->
		<div class="card" style="margin-bottom: 20px;">
			<div class="card-header">
				<span>📡</span>
				<span style="font-weight: 700;">Endpoints</span>
			</div>
			<div class="card-body">
				{#each endpoints as ep}
					<div class="endpoint">
						<div class="ep-row">
							<span class="ep-method {ep.method.toLowerCase()}">{ep.method}</span>
							<code class="ep-path">{ep.path}</code>
						</div>
						<p class="ep-desc">{ep.description}</p>
						{#if ep.auth}
							<span class="ep-auth font-mono">🔒 Requires auth</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Rate Limits -->
		<div class="card" style="margin-bottom: 20px;">
			<div class="card-header">
				<span>⏱️</span>
				<span style="font-weight: 700;">Rate Limits</span>
			</div>
			<div class="card-body">
				<div class="rate-grid">
					<div class="rate-item">
						<div class="rate-plan">Free</div>
						<div class="rate-limit">3 requests/month</div>
					</div>
					<div class="rate-item">
						<div class="rate-plan">Starter</div>
						<div class="rate-limit">30 requests/month</div>
					</div>
					<div class="rate-item">
						<div class="rate-plan">Agency</div>
						<div class="rate-limit">Unlimited</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Example -->
		<div class="card">
			<div class="card-header">
				<span>💻</span>
				<span style="font-weight: 700;">Quick Start</span>
			</div>
			<div class="card-body">
				<pre class="code-block">{`curl -X POST https://api-bscan.balancewises.io/api/scan \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "url": "https://example.com",
    "email": "you@company.com"
  }'`}</pre>
			</div>
		</div>
	</div>
</div>

<script module lang="ts">
	const endpoints = [
		{ method: 'POST', path: '/api/scan', description: 'Run a full website audit scan', auth: true },
		{ method: 'POST', path: '/api/scan/check', description: 'Check scan allowance for an email', auth: false },
		{ method: 'POST', path: '/api/scan/chat', description: 'Chat with AI about scan results', auth: false },
		{ method: 'GET', path: '/api/scans/leaderboard', description: 'Get the public leaderboard', auth: false },
		{ method: 'GET', path: '/api/scans/history', description: 'Get your scan history', auth: true },
		{ method: 'POST', path: '/api/scan/compare', description: 'Compare two websites side-by-side', auth: true },
		{ method: 'POST', path: '/api/seo/keywords', description: 'Keyword research for a topic', auth: true },
		{ method: 'POST', path: '/api/seo/backlinks', description: 'Backlink analysis for a domain', auth: true },
		{ method: 'POST', path: '/api/auth/login', description: 'Authenticate and get a token', auth: false },
		{ method: 'POST', path: '/api/auth/register', description: 'Create a new account', auth: false },
		{ method: 'GET', path: '/api/auth/me', description: 'Get current user info', auth: true },
		{ method: 'POST', path: '/api/billing/checkout/:plan', description: 'Create a Stripe checkout session', auth: false },
		{ method: 'GET', path: '/api/team', description: 'Get team members', auth: true },
		{ method: 'POST', path: '/api/team/invite', description: 'Invite a team member', auth: true },
	];
</script>

<style>
	.page-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.page-header h1 { font-style: italic; margin: 8px 0; }

	.code-block {
		display: block;
		background: var(--clr-bg-primary);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-md);
		padding: 14px 18px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--clr-text-secondary);
		overflow-x: auto;
		white-space: pre;
		line-height: 1.6;
	}

	.endpoint {
		padding: 14px 0;
		border-bottom: 1px solid var(--clr-border);
	}

	.endpoint:last-child { border-bottom: none; }

	.ep-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 4px;
	}

	.ep-method {
		padding: 3px 8px;
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.ep-method.post { background: var(--clr-success-dim); color: var(--clr-success); }
	.ep-method.get { background: var(--clr-blue-dim); color: var(--clr-blue); }
	.ep-method.delete { background: var(--clr-danger-dim); color: var(--clr-danger); }

	.ep-path {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--clr-text-primary);
	}

	.ep-desc {
		font-size: 12px;
		color: var(--clr-text-secondary);
	}

	.ep-auth {
		font-size: 10px;
		color: var(--clr-warning);
		margin-top: 4px;
		display: inline-block;
	}

	.rate-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.rate-item {
		text-align: center;
		padding: 16px;
		background: var(--clr-bg-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--clr-border);
	}

	.rate-plan {
		font-size: 12px;
		font-weight: 700;
		color: var(--clr-text-muted);
		text-transform: uppercase;
		font-family: var(--font-mono);
		margin-bottom: 4px;
	}

	.rate-limit {
		font-size: 14px;
		font-weight: 600;
	}
</style>
