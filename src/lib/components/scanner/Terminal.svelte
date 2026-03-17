<script lang="ts">
	import { scan } from '$lib/stores/scan';

	let terminalEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		$scan.steps;
		requestAnimationFrame(() => {
			if (terminalEl) terminalEl.scrollTop = terminalEl.scrollHeight;
		});
	});
</script>

{#if $scan.steps.length > 0}
	<div class="terminal-wrap animate-fade-up">
		<div class="terminal" bind:this={terminalEl} role="log" aria-live="polite" aria-label="Scan progress">
			{#each $scan.steps as step}
				<div class="t-line">
					<span class="t-prefix">[{String(step.index).padStart(2, '0')}]</span>
					<span class="t-text">{step.text}</span>
					<span class="t-status" class:t-ok={step.status === 'ok'} class:t-fail={step.status === 'fail'} class:t-warn={step.status === 'warn'}>
						{step.status === 'ok' ? '✓' : step.status === 'warn' ? '⚠' : step.status === 'fail' ? '✗' : '…'}
					</span>
				</div>
			{/each}
		</div>
		<div class="progress-track">
			<div class="progress-fill" style="width: {$scan.progress}%;"></div>
		</div>
	</div>
{/if}

<style>
	.terminal-wrap {
		background: var(--clr-bg-card);
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin-top: var(--space-lg);
	}

	.terminal {
		max-height: 280px;
		overflow-y: auto;
		padding: var(--space-md);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.t-line {
		display: flex;
		gap: 10px;
		padding: 3px 0;
		animation: fadeIn 0.15s ease-out;
	}

	.t-prefix {
		color: var(--clr-text-muted);
		flex-shrink: 0;
		width: 32px;
	}

	.t-text {
		flex: 1;
		color: var(--clr-text-secondary);
	}

	.t-status {
		flex-shrink: 0;
		font-weight: 700;
	}

	.t-ok { color: var(--clr-success); }
	.t-warn { color: var(--clr-warning); }
	.t-fail { color: var(--clr-danger); }

	.progress-track {
		height: 3px;
		background: var(--clr-border);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--clr-blue), var(--clr-gold));
		transition: width 0.4s var(--ease-out);
		border-radius: 2px;
		animation: progressPulse 2s infinite;
	}
</style>
