<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import * as api from '$lib/api/client';
	import Seo from '$lib/components/ui/Seo.svelte';

	type Tab = 'deep' | 'bulk';
	let activeTab = $state<Tab>('deep');

	// Deep crawl
	let deepUrl = $state('');
	let deepMaxPages = $state(10);
	let deepLoading = $state(false);
	let deepResult = $state<any>(null);
	let deepError = $state('');
	let pdfLoading = $state(false);

	// Bulk scan
	let bulkUrls = $state('');
	let bulkLoading = $state(false);
	let bulkResult = $state<any>(null);
	let bulkError = $state('');

	const isPaid = $derived($auth.user?.plan === 'pro' || $auth.user?.plan === 'agency');
	const isAgency = $derived($auth.user?.plan === 'agency');
	const maxPages = 50;
	const maxBulk = 25;

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
				issue_description: issue.description || '',
				issue_category: issue.category || 'general',
				issue_severity: issue.severity || 'warning',
				url: deepResult?.url || deepUrl || '',
			});
			aiFixes = { ...aiFixes, [key]: fix };
		} catch {
			aiFixes = { ...aiFixes, [key]: { error: 'Failed to generate fix.' } };
		}
		aiFixLoading = { ...aiFixLoading, [key]: false };
	}

	async function startDeepCrawl() {
		if (!deepUrl.trim()) { deepError = 'Enter a URL.'; return; }
		deepError = '';
		deepLoading = true;
		deepResult = null;
		try {
			deepResult = await api.deepCrawl(deepUrl.trim(), deepMaxPages);
		} catch (err) {
			deepError = err instanceof Error ? err.message : 'Crawl failed.';
		}
		deepLoading = false;
	}

	async function downloadPdf() {
		if (!deepResult) return;
		pdfLoading = true;
		try {
			const blob = await api.downloadDeepCrawlPdf({ url: deepResult.url || deepUrl, pages: deepResult.pages || [], summary: deepResult.summary || {}, issues: deepResult.issues || [] });
			const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bscan-crawl-report.pdf"; a.click(); URL.revokeObjectURL(a.href);
		} catch { deepError = "PDF generation failed."; }
		pdfLoading = false;
	}

	async function startBulkScan() {
		const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 3);
		if (urls.length === 0) { bulkError = 'Enter at least one URL.'; return; }
		bulkError = '';
		bulkLoading = true;
		bulkResult = null;
		try {
			bulkResult = await api.bulkScan(urls.slice(0, maxBulk));
		} catch (err) {
			bulkError = err instanceof Error ? err.message : 'Scan failed.';
		}
		bulkLoading = false;
	}

	function scoreColor(s: number): string {
		if (s >= 80) return 'var(--clr-success)';
		if (s >= 60) return 'var(--clr-warning)';
		return 'var(--clr-danger)';
	}

	function getDomain(url: string): string {
		return url?.replace('https://', '').replace('http://', '').split('/')[0] || '';
	}
</script>

<Seo
	title="Deep Crawl — Multi-Page Website Audit Tool"
	description="Crawl up to 50 internal pages and audit each one. Find issues across your entire site with bulk URL scanning. Agency plan feature."
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "BSCAN Deep Crawl",
		"url": "https://bscan.balancewises.io/deep-crawl",
		"applicationCategory": "SEO Tool",
		"description": "Multi-page website crawler that audits up to 50 pages at once. Identifies issues across your entire site with AI-powered fix suggestions.",
		"operatingSystem": "All",
		"offers": { "@type": "Offer", "price": "29.00", "priceCurrency": "GBP", "description": "Agency plan — £29/month" }
	}}
/>

<div class="container" style="max-width: 960px;">
	<div class="page-header animate-fade-up">
		<span class="badge badge-blue">🕷️ CRAWL</span>
		<h1>Deep Crawl & <span class="text-gold">Bulk Scan</span></h1>
		<p class="text-secondary">Multi-page site audits and batch URL scanning.</p>
	</div>

	{#if !$auth.user}
		<!-- Not logged in -->
		<div class="card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 40px;">
				<div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
				<h3>Sign in to access Deep Crawl</h3>
				<p class="text-muted" style="margin: 8px 0 20px;">Deep Crawl & Bulk Scan is an exclusive Agency feature. Sign in or create an account to get started.</p>
				<a href="/account" class="btn btn-gold">Sign In / Create Account →</a>
			</div>
		</div>
	{:else if !isAgency}
		<!-- Logged in but not Agency -->
		<div class="card animate-fade-up">
			<div class="card-body" style="text-align: center; padding: 40px;">
				<div style="font-size: 48px; margin-bottom: 12px;">🕷️</div>
				<h3>Agency Plan Required</h3>
				<p class="text-muted" style="margin: 8px 0 8px;">Deep Crawl & Bulk Scan is available exclusively on the Agency plan.</p>
				<p class="text-muted" style="margin: 0 0 20px; font-size: 13px;">Crawl up to 50 internal pages, scan 25 URLs in parallel, and get AI-powered fix suggestions for every issue found.</p>
				<div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
					<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency — £29/mo</button>
					<span class="text-muted" style="font-size: 11px;">Includes unlimited scans, team management, white-label PDFs, monitoring, and API access.</span>
				</div>
			</div>
		</div>
	{:else}
		<!-- Tabs -->
		<div class="tab-bar animate-fade-up">
			<button class="tab" class:active={activeTab === 'deep'} onclick={() => activeTab = 'deep'}>🕷️ Site Crawl</button>
			<button class="tab" class:active={activeTab === 'bulk'} onclick={() => activeTab = 'bulk'}>📋 Bulk Scan</button>
		</div>

		<!-- Deep Crawl Tab -->
		{#if activeTab === 'deep'}
			<div class="card animate-fade-up" style="margin-bottom: 20px;">
				<div class="card-header">
					<span>🕷️</span>
					<span style="font-weight: 700;">Multi-Page Site Audit</span>
					<span class="text-muted" style="margin-left: auto; font-size: 11px;">Up to {maxPages} pages</span>
				</div>
				<div class="card-body">
					<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Enter your homepage URL. We'll follow internal links and audit each page.</p>
					<div class="input-row">
						<input class="input" type="url" placeholder="https://yoursite.com" bind:value={deepUrl} style="flex: 1;" onkeydown={(e) => e.key === 'Enter' && startDeepCrawl()} />
						<select class="input" bind:value={deepMaxPages} style="width: 100px;">
							<option value={5}>5 pages</option>
							<option value={10}>10 pages</option>
							<option value={25}>25 pages</option>
							<option value={50}>50 pages</option>
						</select>
						<button class="btn btn-gold" disabled={deepLoading} onclick={startDeepCrawl}>
							{#if deepLoading}⏳ Crawling...{:else}Start Crawl{/if}
						</button>
					</div>
					{#if deepError}<div class="msg-error" style="margin-top: 8px;">{deepError}</div>{/if}
					{#if deepLoading}<p class="text-muted" style="margin-top: 12px; font-size: 12px;">This may take 1-3 minutes depending on the number of pages...</p>{/if}
				</div>
			</div>

			<!-- Deep Crawl Results -->
			{#if deepResult}
				<div class="card animate-fade-up" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>📊</span>
						<span style="font-weight: 700;">Crawl Summary</span>
						<button class="btn btn-gold btn-sm" style="margin-left: auto;" disabled={pdfLoading} onclick={downloadPdf}>{#if pdfLoading}⏳ PDF...{:else}📄 Download PDF{/if}</button>
					</div>
					<div class="card-body">
						<div class="summary-grid">
							<div class="summary-item">
								<div class="summary-label">Pages Scanned</div>
								<div class="summary-value">{deepResult.summary?.total_pages || 0}</div>
							</div>
							<div class="summary-item">
								<div class="summary-label">Avg Score</div>
								<div class="summary-value" style="color: {scoreColor(deepResult.summary?.avg_overall || 0)};">{deepResult.summary?.avg_overall || 0}</div>
							</div>
							<div class="summary-item">
								<div class="summary-label">Critical Issues</div>
								<div class="summary-value" style="color: var(--clr-danger);">{deepResult.summary?.total_critical || 0}</div>
							</div>
							<div class="summary-item">
								<div class="summary-label">Warnings</div>
								<div class="summary-value" style="color: var(--clr-warning);">{deepResult.summary?.total_warnings || 0}</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Pages Table -->
				<div class="card animate-fade-up" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>📄</span>
						<span style="font-weight: 700;">Pages ({deepResult.pages?.length || 0})</span>
					</div>
					<div class="card-body" style="padding: 0;">
						<div class="table-header">
							<span class="th-url">URL</span>
							<span class="th-score">Score</span>
							<span class="th-issues">Issues</span>
						</div>
						{#each (deepResult.pages || []) as page}
							<div class="table-row">
								<div class="td-url">
									<span class="font-mono" style="font-size: 12px;">{page.url?.replace('https://', '').replace('http://', '')}</span>
									{#if page.is_homepage}<span class="badge-sm">HOME</span>{/if}
								</div>
								<div class="td-score" style="color: {scoreColor(page.overall_score || 0)};">{page.overall_score || '—'}</div>
								<div class="td-issues">
									{#if page.critical_count > 0}<span class="issue-badge crit">{page.critical_count} critical</span>{/if}
									{#if page.issues_count > page.critical_count}<span class="issue-badge warn">{page.issues_count - page.critical_count} warnings</span>{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Top Issues Across All Pages -->
				{#if deepResult.issues?.length > 0}
					<div class="card animate-fade-up">
						<div class="card-header">
							<span>⚠️</span>
							<span style="font-weight: 700;">Top Issues Across All Pages</span>
						</div>
						<div class="card-body" style="padding: 0;">
							{#each deepResult.issues.filter((i: any) => i.severity !== 'pass').slice(0, 15) as issue}
								<div class="issue-row">
									<div class="issue-icon" class:crit={issue.severity === 'critical'} class:warn={issue.severity === 'warning'}>
										{issue.severity === 'critical' ? '✗' : '⚠'}
									</div>
									<div class="issue-text">
										<strong>{issue.title}</strong>
										{#if issue.affected_pages > 1}
											<span class="pages-badge">Found on {issue.affected_pages} pages</span>
										{/if}
										<div class="text-muted" style="font-size: 11px; margin-top: 2px;">{issue.description}</div>
										{#if issue.fix}
											<div class="issue-fix">Fix: {issue.fix}</div>
										{/if}
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
														<div class="ai-code-header">
															<span class="ai-code-lang">{snippet.language}</span>
															<span class="ai-code-file">{snippet.filename}</span>
															<button class="ai-copy-btn" onclick={() => navigator.clipboard.writeText(snippet.code)}>Copy</button>
														</div>
														<pre class="ai-code">{snippet.code}</pre>
														<p class="ai-code-explain">{snippet.explanation}</p>
													</div>
												{/each}
												{#if fix.additional_notes}<p class="ai-notes">{fix.additional_notes}</p>{/if}
											</div>
										{:else if aiFixes[issue.title]?.error}
											<div class="ai-fix-error">{aiFixes[issue.title].error}</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		{/if}

		<!-- Bulk Scan Tab -->
		{#if activeTab === 'bulk'}
			<div class="card animate-fade-up" style="margin-bottom: 20px;">
				<div class="card-header">
					<span>📋</span>
					<span style="font-weight: 700;">Bulk URL Scanner</span>
					<span class="text-muted" style="margin-left: auto; font-size: 11px;">Up to {maxBulk} URLs</span>
				</div>
				<div class="card-body">
					<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Paste one URL per line. We'll scan them all in parallel.</p>
					<textarea class="input" rows="8" placeholder="https://site1.com
https://site2.com
https://site3.com" bind:value={bulkUrls} style="font-family: var(--font-mono); font-size: 12px; resize: vertical;"></textarea>
					<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
						<span class="text-muted" style="font-size: 11px;">{bulkUrls.split('\n').filter(u => u.trim().length > 3).length}/{maxBulk} URLs</span>
						<button class="btn btn-gold" disabled={bulkLoading} onclick={startBulkScan}>
							{#if bulkLoading}⏳ Scanning...{:else}Scan All{/if}
						</button>
					</div>
					{#if bulkError}<div class="msg-error" style="margin-top: 8px;">{bulkError}</div>{/if}
					{#if bulkLoading}<p class="text-muted" style="margin-top: 8px; font-size: 12px;">Scanning {bulkUrls.split('\n').filter(u => u.trim()).length} URLs in parallel...</p>{/if}
				</div>
			</div>

			<!-- Bulk Results -->
			{#if bulkResult}
				<div class="card animate-fade-up" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>📊</span>
						<span style="font-weight: 700;">Results — Avg {bulkResult.avg_score}/100</span>
						<span class="text-muted" style="margin-left: auto; font-size: 11px;">{bulkResult.completed}/{bulkResult.total_urls} scanned</span>
					</div>
					<div class="card-body" style="padding: 0;">
						<div class="table-header">
							<span class="th-url">URL</span>
							<span class="th-score">Score</span>
							<span class="th-issues">Issues</span>
						</div>
						{#each (bulkResult.results || []) as result}
							<div class="table-row">
								<div class="td-url font-mono" style="font-size: 12px;">
									{getDomain(result.url)}
									{#if result.status === 'failed'}<span class="issue-badge crit">Failed</span>{/if}
								</div>
								<div class="td-score" style="color: {scoreColor(result.overall_score || 0)};">
									{result.overall_score || '—'}
								</div>
								<div class="td-issues">
									{#if result.critical_count > 0}<span class="issue-badge crit">{result.critical_count}</span>{/if}
									{#if result.issues_count}<span class="issue-badge warn">{result.issues_count}</span>{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.page-header { text-align: center; margin-bottom: var(--space-xl); }
	.page-header h1 { font-style: italic; margin: 8px 0; }

	.tab-bar { display: flex; gap: 4px; margin-bottom: 20px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 4px; }
	.tab { flex: 1; padding: 10px; border: none; background: transparent; color: var(--clr-text-muted); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: var(--radius-md); transition: all 0.15s; }
	.tab.active { background: var(--clr-blue); color: white; }
	.tab:hover:not(.active) { color: var(--clr-text-primary); }

	.input-row { display: flex; gap: 8px; flex-wrap: wrap; }

	.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
	.summary-item { text-align: center; padding: 16px; background: var(--clr-bg-deep); border-radius: var(--radius-md); border: 1px solid var(--clr-border); }
	.summary-label { font-size: 10px; color: var(--clr-text-muted); text-transform: uppercase; font-family: var(--font-mono); margin-bottom: 4px; }
	.summary-value { font-size: 28px; font-weight: 800; }

	.table-header { display: grid; grid-template-columns: 1fr 80px 140px; gap: 8px; padding: 10px 16px; font-size: 11px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; border-bottom: 1px solid var(--clr-border); }
	.table-row { display: grid; grid-template-columns: 1fr 80px 140px; gap: 8px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--clr-border); }
	.table-row:last-child { border-bottom: none; }
	.td-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.td-score { font-size: 20px; font-weight: 800; text-align: center; }
	.td-issues { display: flex; gap: 4px; flex-wrap: wrap; }

	.badge-sm { font-size: 9px; padding: 1px 6px; background: var(--clr-blue-dim); color: var(--clr-blue); border-radius: 4px; margin-left: 6px; font-weight: 700; }
	.issue-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
	.issue-badge.crit { background: rgba(239,68,68,0.1); color: var(--clr-danger); }
	.issue-badge.warn { background: rgba(245,158,11,0.1); color: var(--clr-warning); }

	.issue-row { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--clr-border); }
	.issue-row:last-child { border-bottom: none; }
	.issue-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; margin-top: 2px; }
	.issue-icon.crit { background: rgba(239,68,68,0.15); color: var(--clr-danger); }
	.issue-icon.warn { background: rgba(245,158,11,0.15); color: var(--clr-warning); }
	.issue-text { font-size: 13px; }
	.pages-badge { font-size: 10px; padding: 1px 6px; background: rgba(59,130,246,0.1); color: var(--clr-blue); border-radius: 4px; margin-left: 6px; }
	.issue-fix { color: var(--clr-blue); font-size: 11px; font-style: italic; margin-top: 3px; }

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

	.msg-error { padding: 8px 12px; border-radius: 6px; font-size: 12px; background: rgba(239,68,68,0.1); color: var(--clr-danger); }

	@media (max-width: 640px) {
		.input-row { flex-direction: column; }
		.input-row select { width: 100% !important; }
		.summary-grid { grid-template-columns: repeat(2, 1fr); }
		.table-header { display: none; }
		.table-row { grid-template-columns: 1fr 60px; }
		.td-issues { display: none; }
	}
</style>
