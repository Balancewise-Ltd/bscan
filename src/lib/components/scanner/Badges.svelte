<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '$lib/api/client';
	import { sanitize, sanitizeUrl } from '$lib/utils/security';
	import type { Achievement, ChallengeData } from '$lib/types';

	interface Props {
		scanId: string;
		overallScore: number;
	}

	let { scanId, overallScore }: Props = $props();

	let challenge = $state<ChallengeData | null>(null);
	let loading = $state(true);
	let copied = $state(false);
	let badgeCode = $state<{ html: string; markdown: string; image_url: string; scan_url: string } | null>(null);

	onMount(async () => {
		try {
			challenge = await api.getScanChallenge(scanId);
		} catch { challenge = null; }
		try {
			badgeCode = await api.getScanBadgeCode(scanId);
		} catch { badgeCode = null; }
		loading = false;
	});

	function copyLink() {
		if (!challenge?.challenge_url) return;
		navigator.clipboard.writeText(challenge.challenge_url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function copyEmbed(code: string) {
		navigator.clipboard.writeText(code);
	}

	const badgeUrl = $derived(badgeCode?.image_url || api.getScanBadgeUrl(scanId));
	const embedHtml = $derived(badgeCode?.html || `<a href="https://bscan.balancewises.io" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="Website Score — BSCAN" width="200" height="80"></a>`);
	const embedMd = $derived(badgeCode?.markdown || `[![Website Score](${badgeUrl})](https://bscan.balancewises.io)`);
</script>

{#if !loading}
<div class="badges-section">

	<!-- Achievement Badges -->
	{#if challenge?.achievements && challenge.achievements.length > 0}
		<div class="badge-card">
			<div class="badge-header">
				<span class="badge-icon">🏅</span>
				<div>
					<div class="badge-title">Achievement Badges Earned</div>
					<div class="badge-sub">{challenge.achievements.length} badge{challenge.achievements.length > 1 ? 's' : ''} — embed these on your website for free</div>
				</div>
			</div>

			<div class="achievements-grid">
				{#each challenge.achievements as ach}
					<div class="achievement" style="background: {ach.color}10; border-color: {ach.color}25;">
						<span class="ach-icon">{ach.icon}</span>
						<div>
							<div class="ach-title" style="color: {ach.color};">{sanitize(ach.title)}</div>
							<div class="ach-desc">{sanitize(ach.description)}</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Achievement SVG Preview -->
			<div class="ach-preview">
				{#each challenge.achievements as ach}
					<img
						src={api.getAchievementBadgeUrl(scanId, ach.id)}
						alt={sanitize(ach.title)}
						width="220"
						height="80"
						loading="lazy"
					/>
				{/each}
			</div>

			<!-- First achievement embed code -->
			{#if challenge.achievements.length > 0}
				{@const firstAch = challenge.achievements[0]}
				{@const achSvgUrl = api.getAchievementBadgeUrl(scanId, firstAch.id)}
				{@const achEmbed = `<a href="https://bscan.balancewises.io" target="_blank" rel="noopener"><img src="${achSvgUrl}" alt="${firstAch.title} — BSCAN" width="220" height="80"></a>`}
				<div class="embed-block">
					<div class="embed-label">Embed {sanitize(firstAch.title)} Badge</div>
					<div class="embed-code-wrap">
						<code class="embed-code">{sanitize(achEmbed)}</code>
						<button class="copy-btn" onclick={() => copyEmbed(achEmbed)}>Copy</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Score Badge -->
	<div class="badge-card">
		<div class="badge-header">
			<span class="badge-icon">🏅</span>
			<div>
				<div class="badge-title">Share Your Score</div>
				<div class="badge-sub">Embed this badge on your website or README</div>
			</div>
		</div>

		<div class="badge-preview">
			<img src={badgeUrl} alt="Score Badge" width="200" height="80" loading="lazy" />
		</div>

		<div class="embed-block">
			<div class="embed-label">HTML Embed</div>
			<div class="embed-code-wrap">
				<code class="embed-code">{sanitize(embedHtml)}</code>
				<button class="copy-btn" onclick={() => copyEmbed(embedHtml)}>Copy</button>
			</div>
		</div>

		<div class="embed-block">
			<div class="embed-label">Markdown</div>
			<div class="embed-code-wrap">
				<code class="embed-code">{sanitize(embedMd)}</code>
				<button class="copy-btn" onclick={() => copyEmbed(embedMd)}>Copy</button>
			</div>
		</div>

		<div class="share-row">
			<a
				href="https://twitter.com/intent/tweet?text=My%20website%20scored%20{overallScore}%2F100%20on%20BSCAN!%20Check%20yours%3A%20https%3A%2F%2Fbscan.balancewises.io"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn"
			>Share on X</a>
			<a
				href="https://www.linkedin.com/sharing/share-offsite/?url=https://bscan.balancewises.io"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn"
			>Share on LinkedIn</a>
			<a href="/leaderboard" class="share-btn gold">🏆 View Leaderboard</a>
		</div>
	</div>

	<!-- Challenge Section -->
	{#if challenge}
		<div class="challenge-card">
			<div style="font-size: 28px; margin-bottom: 8px;">⚔️</div>
			<h3>Challenge Your Competitors</h3>
			<p class="text-secondary">Share your score and challenge others to beat it. Every click brings them to BSCAN.</p>

			<div class="challenge-share-btns">
				{#if challenge.share_urls?.twitter}
					<a href={sanitizeUrl(challenge.share_urls.twitter)} target="_blank" rel="noopener noreferrer" class="ch-btn ch-x">𝕏 Share on X</a>
				{/if}
				{#if challenge.share_urls?.linkedin}
					<a href={sanitizeUrl(challenge.share_urls.linkedin)} target="_blank" rel="noopener noreferrer" class="ch-btn ch-li">in Share on LinkedIn</a>
				{/if}
				{#if challenge.share_urls?.whatsapp}
					<a href={sanitizeUrl(challenge.share_urls.whatsapp)} target="_blank" rel="noopener noreferrer" class="ch-btn ch-wa">💬 WhatsApp</a>
				{/if}
				{#if challenge.share_urls?.email}
					<a href={sanitizeUrl(challenge.share_urls.email)} class="ch-btn ch-em">✉️ Email Challenge</a>
				{/if}
			</div>

			<div class="challenge-link-row">
				<input class="input" readonly value={challenge.challenge_url || ''} style="flex: 1; font-size: 11px; font-family: var(--font-mono);" />
				<button class="btn btn-gold btn-sm" onclick={copyLink}>
					{copied ? 'Copied!' : 'Copy Link'}
				</button>
			</div>
		</div>
	{/if}
</div>
{/if}

<style>
	.badges-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: var(--space-lg);
	}

	.badge-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
	}

	.badge-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: var(--space-md);
	}

	.badge-icon { font-size: 20px; }
	.badge-title { font-weight: 700; font-size: 14px; }
	.badge-sub { font-size: 12px; color: var(--clr-text-muted); }

	.achievements-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: var(--space-md);
	}

	.achievement {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: var(--radius-md);
		border: 1px solid;
	}

	.ach-icon { font-size: 18px; }
	.ach-title { font-size: 12px; font-weight: 700; }
	.ach-desc { font-size: 10px; color: var(--clr-text-muted); }

	.ach-preview {
		text-align: center;
		padding: 12px;
		background: var(--clr-bg-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--clr-border);
		margin-bottom: var(--space-md);
	}

	.ach-preview img { margin: 4px; }

	.badge-preview {
		text-align: center;
		padding: 20px;
		background: var(--clr-bg-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--clr-border);
		margin-bottom: var(--space-md);
	}

	.embed-block { margin-bottom: 10px; }

	.embed-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--clr-text-muted);
		text-transform: uppercase;
		letter-spacing: 1px;
		font-family: var(--font-mono);
		margin-bottom: 4px;
	}

	.embed-code-wrap { position: relative; }

	.embed-code {
		display: block;
		background: var(--clr-bg-primary);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		padding-right: 60px;
		font-size: 11px;
		color: var(--clr-text-secondary);
		font-family: var(--font-mono);
		word-break: break-all;
		line-height: 1.5;
	}

	.copy-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		padding: 4px 10px;
		border-radius: 4px;
		border: 1px solid var(--clr-border);
		background: var(--clr-bg-card);
		color: var(--clr-text-secondary);
		font-size: 10px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: background var(--duration-fast);
	}

	.copy-btn:hover { background: var(--clr-bg-elevated); }

	.share-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: var(--space-md);
	}

	.share-btn {
		padding: 6px 14px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--clr-border);
		color: var(--clr-text-secondary);
		font-size: 11px;
		font-weight: 600;
		text-decoration: none;
		transition: all var(--duration-fast);
	}

	.share-btn:hover { border-color: var(--clr-border-light); color: var(--clr-text-primary); }
	.share-btn.gold { border-color: rgba(240,165,0,0.2); color: var(--clr-gold); }

	/* ── Challenge ────────────────────── */
	.challenge-card {
		background: linear-gradient(135deg, rgba(240,165,0,0.06), rgba(59,130,246,0.04));
		border: 1px solid var(--clr-border-light);
		border-radius: var(--radius-xl);
		padding: 28px;
		text-align: center;
	}

	.challenge-card h3 {
		font-size: 18px;
		font-weight: 800;
		font-style: italic;
		margin-bottom: 6px;
	}

	.challenge-card p {
		font-size: 13px;
		margin-bottom: 20px;
		line-height: 1.5;
	}

	.challenge-share-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
		margin-bottom: 16px;
	}

	.ch-btn {
		padding: 10px 20px;
		border-radius: var(--radius-md);
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: opacity var(--duration-fast);
	}

	.ch-btn:hover { opacity: 0.9; }
	.ch-x { background: #000; color: #fff; }
	.ch-li { background: #0a66c2; color: #fff; }
	.ch-wa { background: #25d366; color: #fff; }
	.ch-em { background: var(--clr-bg-card); color: var(--clr-text-primary); border: 1px solid var(--clr-border); }

	.challenge-link-row {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 500px;
		margin: 0 auto;
	}

	@media (max-width: 640px) {
		.achievements-grid { flex-direction: column; }
		.challenge-link-row { flex-direction: column; }
		.challenge-link-row .input { width: 100%; }
	}
</style>
