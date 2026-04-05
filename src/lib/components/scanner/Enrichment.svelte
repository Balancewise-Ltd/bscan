<script lang="ts">
	import type { Enrichment, TechStack } from '$lib/types';
	import { sanitize, sanitizeUrl } from '$lib/utils/security';

	interface Props {
		enrichment: Enrichment;
		isPaid: boolean;
	}

	let { enrichment, isPaid }: Props = $props();

	const ssl = $derived(enrichment.ssl_details);
	const geo = $derived(enrichment.server_location);
	const green = $derived(enrichment.green_hosting);
	const safe = $derived(enrichment.safe_browsing);
	const whois = $derived(enrichment.whois);
	const obs = $derived(enrichment.observatory);
	const w3c = $derived(enrichment.w3c_validation);
	const wb = $derived(enrichment.wayback);
	const tech = $derived(enrichment.tech_stack);
	const screenshot = $derived(enrichment.screenshot_url);

	function gradeColor(grade: string | undefined): string {
		if (!grade) return 'var(--clr-text-muted)';
		if (grade.startsWith('A')) return 'var(--clr-success)';
		if (grade.startsWith('B')) return 'var(--clr-info)';
		if (grade.startsWith('C')) return 'var(--clr-warning)';
		return 'var(--clr-danger)';
	}

	function techColor(name: string, cats?: TechStack['categories']): { bg: string; fg: string } {
		if (!cats) return { bg: 'var(--clr-bg-primary)', fg: 'var(--clr-text-secondary)' };
		if (name === cats.cms) return { bg: 'rgba(240,165,0,0.1)', fg: 'var(--clr-gold)' };
		if (name === cats.js_framework) return { bg: 'rgba(59,130,246,0.1)', fg: 'var(--clr-blue)' };
		if (name === cats.server || name === cats.cdn) return { bg: 'rgba(16,185,129,0.1)', fg: 'var(--clr-success)' };
		if (name === cats.ecommerce) return { bg: 'rgba(139,92,246,0.1)', fg: '#8b5cf6' };
		return { bg: 'var(--clr-bg-primary)', fg: 'var(--clr-text-secondary)' };
	}
</script>

{#if enrichment && Object.keys(enrichment).length > 0}
<div class="enrichment-section">

	<!-- Screenshot -->
	{#if screenshot}
		<div class="enrich-card">
			<div class="enrich-header">
				<span class="enrich-icon">📸</span>
				<span class="enrich-title">Site Preview</span>
			</div>
			<div class="screenshot-wrap">
				<img
					src={sanitizeUrl(screenshot)}
					alt="Website Screenshot"
					class="screenshot-img"
					loading="lazy"
					onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
				/>
			</div>
		</div>
	{/if}

	<!-- Site Intelligence Grid -->
	<div class="enrich-card">
		<div class="enrich-header">
			<span class="enrich-icon">🔬</span>
			<span class="enrich-title">Site Intelligence</span>
			<span class="enrich-badge">ENRICHED ANALYSIS</span>
		</div>
		<div class="intel-grid">

			{#if ssl?.ssl_grade}
				<div class="intel-cell">
					<div class="intel-label">SSL Certificate</div>
					<div class="intel-value" style="font-size: 24px; color: {gradeColor(ssl.ssl_grade)};">{sanitize(ssl.ssl_grade)}</div>
					<div class="intel-sub">{sanitize(ssl.ssl_issuer) || 'Unknown'}</div>
					{#if ssl.ssl_days_remaining}
						<div class="intel-detail">{ssl.ssl_days_remaining} days until expiry</div>
					{/if}
				</div>
			{/if}

			{#if geo?.server_country}
				<div class="intel-cell">
					<div class="intel-label">Server Location</div>
					<div class="intel-value">{geo.server_city ? sanitize(geo.server_city) + ', ' : ''}{sanitize(geo.server_country)}</div>
					{#if geo.server_isp}<div class="intel-sub">{sanitize(geo.server_isp)}</div>{/if}
					{#if geo.server_ip}<div class="intel-detail font-mono">{sanitize(geo.server_ip)}</div>{/if}
				</div>
			{/if}

			{#if green && green.is_green !== null && green.is_green !== undefined}
				<div class="intel-cell">
					<div class="intel-label">Green Energy</div>
					<div class="intel-value" style="color: {green.is_green ? 'var(--clr-success)' : 'var(--clr-text-muted)'};">
						{green.is_green ? '🌱 Green Hosted' : '⚫ Standard Hosting'}
					</div>
					{#if green.green_hosting_provider}
						<div class="intel-sub">{sanitize(green.green_hosting_provider)}</div>
					{/if}
				</div>
			{/if}

			{#if safe?.safe_browsing_status && safe.safe_browsing_status !== 'not_checked'}
				<div class="intel-cell">
					<div class="intel-label">Google Safe Browsing</div>
					<div class="intel-value" style="color: {safe.is_safe ? 'var(--clr-success)' : 'var(--clr-danger)'};">
						{safe.is_safe ? '✓ Safe' : '⚠ Flagged'}
					</div>
					<div class="intel-sub">Checked against Google threat database</div>
				</div>
			{/if}

			{#if whois?.domain_age_text}
				<div class="intel-cell">
					<div class="intel-label">Domain Age</div>
					<div class="intel-value" style="color: {whois.is_new_domain ? 'var(--clr-warning)' : 'var(--clr-success)'};">
						{sanitize(whois.domain_age_text)}
					</div>
					{#if whois.registrar}<div class="intel-sub">Registrar: {sanitize(whois.registrar)}</div>{/if}
					{#if whois.expiry_date}<div class="intel-detail">Expires: {sanitize(whois.expiry_date)}</div>{/if}
				</div>
			{/if}

			{#if obs?.observatory_grade}
				<div class="intel-cell">
					<div class="intel-label">Mozilla Observatory</div>
					<div class="intel-value" style="font-size: 24px; color: {gradeColor(obs.observatory_grade)};">
						{sanitize(obs.observatory_grade)}
					</div>
					<div class="intel-sub">{obs.observatory_score || 0}/100 · {obs.observatory_tests_passed || 0} passed</div>
				</div>
			{/if}

			{#if w3c && w3c.html_valid !== null && w3c.html_valid !== undefined}
				<div class="intel-cell">
					<div class="intel-label">W3C Validation</div>
					<div class="intel-value" style="color: {w3c.html_valid ? 'var(--clr-success)' : (w3c.html_errors || 0) > 10 ? 'var(--clr-danger)' : 'var(--clr-warning)'};">
						{w3c.html_valid ? 'Valid HTML' : `${w3c.html_errors || 0} errors`}
					</div>
					<div class="intel-sub">{w3c.html_warnings || 0} warnings</div>
				</div>
			{/if}

			{#if wb?.has_archive}
				<div class="intel-cell">
					<div class="intel-label">Web Archive</div>
					<div class="intel-value" style="color: var(--clr-info);">Archived</div>
					{#if wb.first_archived}<div class="intel-sub">First seen: {sanitize(wb.first_archived)}</div>{/if}
					{#if wb.wayback_url}
						<a href={sanitizeUrl(wb.wayback_url)} target="_blank" rel="noopener noreferrer" class="intel-link">View on Wayback Machine →</a>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Tech Stack -->
	{#if tech?.technologies && tech.technologies.length > 0}
		<div class="enrich-card">
			<div class="enrich-header">
				<span class="enrich-icon">⚙️</span>
				<span class="enrich-title">Technology Stack</span>
				<span class="enrich-badge">{tech.tech_count} detected</span>
			</div>
			<div class="tech-tags">
				{#each tech.technologies as t}
					{@const colors = techColor(t, tech.categories)}
					<span class="tech-tag" style="background: {colors.bg}; color: {colors.fg}; border-color: {colors.fg}20;">
						{sanitize(t)}
					</span>
				{/each}
			</div>
			{#if tech.categories}
				{@const cats = tech.categories}
				{@const summary = [
					cats.cms && `CMS: ${cats.cms}`,
					cats.js_framework && `Framework: ${cats.js_framework}`,
					cats.server && `Server: ${cats.server}`,
					cats.cdn && `CDN: ${cats.cdn}`,
					cats.ecommerce && `E-commerce: ${cats.ecommerce}`,
					cats.analytics && `Analytics: ${cats.analytics}`
				].filter(Boolean).join(' · ')}
				{#if summary}
					<div class="tech-summary">{summary}</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Upgrade CTA for free users -->
	{#if !isPaid}
		<div class="enrich-upgrade">
			<div style="font-size: 24px; margin-bottom: 8px;">🔬</div>
			<h3>Full Site Intelligence</h3>
			<p>Upgrade to Starter to unlock domain age, WHOIS data, W3C validation, Mozilla Observatory score, Wayback history, and more.</p>
			<a href="/pricing" class="btn btn-gold" style="margin-top: 12px;">Upgrade to Starter — £9/mo</a>
		</div>
	{/if}
</div>
{/if}

<style>
	.enrichment-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: var(--space-lg);
	}

	.enrich-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.enrich-header {
		padding: 14px 18px;
		border-bottom: 1px solid var(--clr-border);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.enrich-icon { font-size: 14px; }
	.enrich-title { font-weight: 700; font-size: 13px; }

	.enrich-badge {
		margin-left: auto;
		font-size: 10px;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
		letter-spacing: 0.5px;
	}

	/* ── Screenshot ──────────────────── */
	.screenshot-wrap {
		padding: 12px;
		text-align: center;
		background: var(--clr-bg-primary);
	}

	.screenshot-img {
		max-width: 100%;
		border-radius: var(--radius-sm);
		border: 1px solid var(--clr-border);
	}

	/* ── Intel Grid ──────────────────── */
	.intel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1px;
		background: var(--clr-border);
	}

	.intel-cell {
		padding: 16px 18px;
		background: var(--clr-bg-card);
	}

	.intel-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--clr-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-family: var(--font-mono);
		margin-bottom: 6px;
	}

	.intel-value {
		font-size: 15px;
		font-weight: 700;
		color: var(--clr-text-primary);
		line-height: 1.3;
	}

	.intel-sub {
		font-size: 11px;
		color: var(--clr-text-secondary);
		margin-top: 2px;
	}

	.intel-detail {
		font-size: 10px;
		color: var(--clr-text-muted);
		font-family: var(--font-mono);
		margin-top: 2px;
	}

	.intel-link {
		font-size: 10px;
		color: var(--clr-blue);
		text-decoration: none;
		margin-top: 4px;
		display: inline-block;
	}

	.intel-link:hover { text-decoration: underline; }

	/* ── Tech Stack ──────────────────── */
	.tech-tags {
		padding: 14px 18px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tech-tag {
		padding: 4px 10px;
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-mono);
		border: 1px solid;
	}

	.tech-summary {
		padding: 10px 18px;
		border-top: 1px solid var(--clr-border);
		font-size: 11px;
		color: var(--clr-text-muted);
	}

	/* ── Upgrade CTA ─────────────────── */
	.enrich-upgrade {
		background: var(--clr-bg-card);
		border: 2px dashed var(--clr-border-light);
		border-radius: var(--radius-xl);
		padding: 28px;
		text-align: center;
	}

	.enrich-upgrade h3 {
		font-size: 14px;
		margin-bottom: 4px;
	}

	.enrich-upgrade p {
		font-size: 12px;
		color: var(--clr-text-secondary);
		line-height: 1.6;
		max-width: 380px;
		margin: 0 auto;
	}

	@media (max-width: 640px) {
		.intel-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 400px) {
		.intel-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
