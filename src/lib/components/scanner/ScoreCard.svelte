<script lang="ts">
	import { scoreLevel, scoreLevelText } from '$lib/utils/score';
	import type { IssueCategory, ScanIssue, Enrichment } from '$lib/types';

	interface Props {
		category: IssueCategory;
		label: string;
		icon: string;
		score: number;
		issues: ScanIssue[];
		enrichment?: Enrichment;
		onclick?: () => void;
	}

	let { category, label, icon, score, issues, enrichment, onclick }: Props = $props();

	const level = $derived(scoreLevel(score));
	const levelText = $derived(scoreLevelText(score));

	const catIssues = $derived(issues.filter((i) => i.category === category));
	const criticals = $derived(catIssues.filter((i) => i.severity === 'critical').length);
	const warnings = $derived(catIssues.filter((i) => i.severity === 'warning').length);
	const passed = $derived(catIssues.filter((i) => i.severity === 'pass').length);
</script>

<button class="score-card {level}" onclick={onclick} type="button">
	<div class="card-score">{score}</div>
	<div class="card-label">{label}</div>
	<div class="card-tag">{levelText}</div>

	<div class="card-stats">
		{#if criticals > 0}
			<div class="stat">
				<span>Critical</span>
				<span class="val danger">{criticals}</span>
			</div>
		{/if}
		{#if warnings > 0}
			<div class="stat">
				<span>Warnings</span>
				<span class="val warn">{warnings}</span>
			</div>
		{/if}
		<div class="stat">
			<span>Passed</span>
			<span class="val good">{passed}</span>
		</div>
	</div>

	<div class="card-tap">tap for details →</div>
</button>

<style>
	.score-card {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		padding: 18px;
		text-align: center;
		transition: all var(--duration-normal) var(--ease-out);
		position: relative;
		overflow: hidden;
		cursor: pointer;
		width: 100%;
		font-family: inherit;
		color: inherit;
	}

	.score-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
	}

	.score-card.excellent::before { background: var(--clr-success); }
	.score-card.good::before { background: var(--clr-info); }
	.score-card.warning::before { background: var(--clr-warning); }
	.score-card.poor::before { background: var(--clr-danger); }

	.score-card:hover {
		border-color: var(--clr-border-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.score-card:active { transform: translateY(0); }

	.card-score {
		font-size: 36px;
		font-weight: 800;
		letter-spacing: -2px;
		line-height: 1;
		margin-bottom: 2px;
	}

	.excellent .card-score { color: var(--clr-success); }
	.good .card-score { color: var(--clr-info); }
	.warning .card-score { color: var(--clr-warning); }
	.poor .card-score { color: var(--clr-danger); }

	.card-label {
		font-size: 12px;
		color: var(--clr-text-secondary);
		font-weight: 500;
		margin-bottom: 4px;
	}

	.card-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 3px 8px;
		border-radius: var(--radius-full);
		display: inline-block;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.excellent .card-tag { background: var(--clr-success-dim); color: var(--clr-success); }
	.good .card-tag { background: var(--clr-info-dim); color: var(--clr-info); }
	.warning .card-tag { background: var(--clr-warning-dim); color: var(--clr-warning); }
	.poor .card-tag { background: var(--clr-danger-dim); color: var(--clr-danger); }

	.card-stats {
		font-size: 10px;
		color: var(--clr-text-muted);
		margin-top: 6px;
		padding-top: 8px;
		border-top: 1px solid var(--clr-border);
		text-align: left;
	}

	.stat {
		display: flex;
		justify-content: space-between;
		padding: 2px 0;
	}

	.val {
		font-family: var(--font-mono);
		font-weight: 600;
	}

	.val.good { color: var(--clr-success); }
	.val.warn { color: var(--clr-warning); }
	.val.danger { color: var(--clr-danger); }

	.card-tap {
		font-size: 9px;
		color: var(--clr-text-muted);
		margin-top: 6px;
		opacity: 0.5;
		font-family: var(--font-mono);
	}
</style>
