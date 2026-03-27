import { writable, derived } from 'svelte/store';
import type { ScanResult, ScanCheckResult, ScanStep, Plan } from '$lib/types';
import * as api from '$lib/api/client';

export type ScanStatus = 'idle' | 'gating' | 'checking' | 'scanning' | 'done' | 'error';

const _status = writable<ScanStatus>('idle');
const _result = writable<ScanResult | null>(null);
const _checkResult = writable<ScanCheckResult | null>(null);
const _progress = writable(0);
const _steps = writable<ScanStep[]>([]);
const _error = writable<string | null>(null);
const _currentUrl = writable('');
const _lastScanId = writable<string | null>(null);

const _store = derived(
	[_status, _result, _checkResult, _progress, _steps, _error, _currentUrl, _lastScanId],
	([$status, $result, $checkResult, $progress, $steps, $error, $currentUrl, $lastScanId]) => ({
		status: $status,
		result: $result,
		checkResult: $checkResult,
		progress: $progress,
		steps: $steps,
		error: $error,
		currentUrl: $currentUrl,
		lastScanId: $lastScanId,
		isScanning: $status === 'scanning' || $status === 'checking',
		hasResult: $result !== null
	})
);

function getSteps(url: string, isPaid: boolean): Array<{ text: string; progress: number }> {
	const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
	if (isPaid) {
		return [
			{ text: 'Initialising BSCAN engine...', progress: 3 },
			{ text: `Resolving ${domain}...`, progress: 6 },
			{ text: 'Rendering page via Cloudflare...', progress: 10 },
			{ text: 'Verifying SSL certificate...', progress: 14 },
			{ text: 'Fetching page content...', progress: 18 },
			{ text: 'Detecting technology stack...', progress: 22 },
			{ text: 'Scanning meta tags & Open Graph...', progress: 26 },
			{ text: 'Analysing heading hierarchy...', progress: 30 },
			{ text: 'Crawling links for broken URLs...', progress: 34 },
			{ text: 'Auditing image alt text...', progress: 38 },
			{ text: 'Checking form labels & ARIA...', progress: 42 },
			{ text: 'Scanning for exposed API keys...', progress: 46 },
			{ text: 'Connecting to Google Lighthouse...', progress: 50 },
			{ text: 'Running Core Web Vitals audit...', progress: 55 },
			{ text: 'Measuring Largest Contentful Paint...', progress: 60 },
			{ text: 'Measuring Cumulative Layout Shift...', progress: 64 },
			{ text: 'Measuring Total Blocking Time...', progress: 68 },
			{ text: 'Checking server location & hosting...', progress: 72 },
			{ text: 'Validating HTML (W3C)...', progress: 76 },
			{ text: 'Checking domain WHOIS...', progress: 80 },
			{ text: 'Verifying Google Safe Browsing...', progress: 84 },
			{ text: 'Checking green hosting status...', progress: 88 },
			{ text: 'Scoring accessibility compliance...', progress: 91 },
			{ text: 'Scoring SEO signals...', progress: 94 },
			{ text: 'Compiling final report...', progress: 97 }
		];
	}
	return [
		{ text: 'Initialising BSCAN...', progress: 5 },
		{ text: `Resolving ${domain}...`, progress: 12 },
		{ text: 'Checking SSL certificate...', progress: 22 },
		{ text: 'Fetching page content...', progress: 34 },
		{ text: 'Detecting technology stack...', progress: 44 },
		{ text: 'Scanning meta tags...', progress: 54 },
		{ text: 'Analysing heading hierarchy...', progress: 62 },
		{ text: 'Crawling links...', progress: 70 },
		{ text: 'Auditing images & accessibility...', progress: 78 },
		{ text: 'Scanning security & exposed keys...', progress: 86 },
		{ text: 'Checking server & hosting...', progress: 92 },
		{ text: 'Compiling report...', progress: 97 }
	];
}

let stepTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopTimer() {
	if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
}

function stopPollTimer() {
	if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function startScan(url: string, email: string, businessName?: string, plan: Plan = 'guest') {
	stopTimer();
	stopPollTimer();
	_status.set('scanning');
	_error.set(null);
	_result.set(null);
	_progress.set(0);
	_steps.set([]);
	_currentUrl.set(url);

	const isPaid = plan === 'pro' || plan === 'agency';
	const scanSteps = getSteps(url, isPaid);
	const interval = isPaid ? 500 : 400;
	let stepIndex = 0;

	// Start step animation
	stepTimer = setInterval(() => {
		if (stepIndex >= scanSteps.length) { stopTimer(); return; }
		const step = scanSteps[stepIndex];
		_steps.update((s) => [...s, { index: stepIndex + 1, text: step.text, progress: step.progress, status: 'ok' }]);
		_progress.set(step.progress);
		stepIndex++;
	}, interval);

	try {
		// 1. Submit scan — returns instantly with {id, status: "running"}
		const data = await api.runScan(url, email, businessName);
		const scanId = data.id;
		_lastScanId.set(scanId);

		// 2. If scan already completed (sync fallback), show result immediately
		if (data.status !== 'running' && data.overall_score !== null && data.overall_score !== undefined) {
			stopTimer();
			while (stepIndex < scanSteps.length) {
				const step = scanSteps[stepIndex];
				_steps.update((s) => [...s, { index: stepIndex + 1, text: step.text, progress: step.progress, status: 'ok' }]);
				stepIndex++;
			}
			_steps.update((s) => [...s, { index: stepIndex + 1, text: 'Report generated ✓', progress: 100, status: 'ok' }]);
			_progress.set(100);
			await new Promise((r) => setTimeout(r, 600));
			_result.set(data);
			_status.set('done');
			return;
		}

		// 3. Poll for results every 4 seconds, up to 5 minutes
		const POLL_INTERVAL = 4000;
		const MAX_POLLS = 75; // 75 * 4s = 5 minutes
		let pollCount = 0;

		pollTimer = setInterval(async () => {
			pollCount++;

			try {
				const result = await api.getScanResult(scanId);

				// Still running — keep polling, keep step animation going
				if (result.status === 'running') {
					// If steps ran out, add waiting steps to keep animation alive
					if (stepIndex >= scanSteps.length && stepTimer === null) {
						const waitSteps = [
							'Waiting for scan worker...',
							'Processing page content...',
							'Running deep analysis...',
							'Almost there...',
						];
						const waitIdx = Math.min(pollCount % waitSteps.length, waitSteps.length - 1);
						const prog = Math.min(97, 92 + pollCount % 6);
						_steps.update((s) => {
							// Replace last "waiting" step instead of accumulating
							const last = s[s.length - 1];
							if (last && last.text.startsWith('Waiting') || last?.text.startsWith('Processing') || last?.text.startsWith('Running deep') || last?.text.startsWith('Almost')) {
								return [...s.slice(0, -1), { index: s.length, text: waitSteps[waitIdx], progress: prog, status: 'ok' }];
							}
							return [...s, { index: s.length + 1, text: waitSteps[waitIdx], progress: prog, status: 'ok' }];
						});
						_progress.set(prog);
					}

					// Timeout check
					if (pollCount >= MAX_POLLS) {
						stopPollTimer();
						stopTimer();
						_steps.update((s) => [...s, { index: stepIndex + 1, text: 'Scan timed out — try again', progress: 0, status: 'fail' }]);
						_error.set('Scan timed out after 5 minutes. Please try again.');
						_status.set('error');
					}
					return;
				}

				// Scan completed (or failed) — stop polling, show result
				stopPollTimer();
				stopTimer();

				if (result.status === 'failed') {
					_steps.update((s) => [...s, { index: stepIndex + 1, text: 'Scan failed', progress: 0, status: 'fail' }]);
					_error.set('Scan failed. Please try again.');
					_status.set('error');
					return;
				}

				// Success — flush remaining steps and show result
				while (stepIndex < scanSteps.length) {
					const step = scanSteps[stepIndex];
					_steps.update((s) => [...s, { index: stepIndex + 1, text: step.text, progress: step.progress, status: 'ok' }]);
					stepIndex++;
				}
				_steps.update((s) => [...s, { index: stepIndex + 1, text: 'Report generated ✓', progress: 100, status: 'ok' }]);
				_progress.set(100);
				await new Promise((r) => setTimeout(r, 600));
				_result.set(result);
				_status.set('done');

			} catch {
				// Network error during poll — don't crash, just retry on next interval
				if (pollCount >= MAX_POLLS) {
					stopPollTimer();
					stopTimer();
					_error.set('Lost connection to scan server. Please try again.');
					_status.set('error');
				}
			}
		}, POLL_INTERVAL);

	} catch (err) {
		stopTimer();
		stopPollTimer();
		const msg = err instanceof Error ? err.message : 'Scan failed';
		_steps.update((s) => [...s, { index: stepIndex + 1, text: `Error: ${msg}`, progress: 0, status: 'fail' }]);
		_error.set(msg);
		_status.set('error');
	}
}

async function checkAllowance(email: string): Promise<ScanCheckResult> {
	const check = await api.checkScanAllowance(email);
	_checkResult.set(check);
	return check;
}

function reset() {
	stopTimer();
	stopPollTimer();
	_status.set('idle');
	_result.set(null);
	_error.set(null);
	_progress.set(0);
	_steps.set([]);
	_currentUrl.set('');
}

export const scan = {
	subscribe: _store.subscribe,
	startScan,
	checkAllowance,
	reset
};
