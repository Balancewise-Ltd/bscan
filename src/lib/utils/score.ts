export function scoreLevel(score: number): 'excellent' | 'good' | 'warning' | 'poor' {
	if (score >= 80) return 'excellent';
	if (score >= 60) return 'good';
	if (score >= 40) return 'warning';
	return 'poor';
}

export function scoreLevelText(score: number): string {
	if (score >= 80) return 'Excellent';
	if (score >= 60) return 'Good';
	if (score >= 40) return 'Warning';
	return 'Poor';
}

export function scoreColor(score: number): string {
	if (score >= 80) return 'var(--clr-success)';
	if (score >= 60) return 'var(--clr-info)';
	if (score >= 40) return 'var(--clr-warning)';
	return 'var(--clr-danger)';
}

export function animateNumber(
	callback: (value: number) => void,
	from: number,
	to: number,
	duration: number = 1000
): void {
	const start = performance.now();
	function tick(now: number) {
		const p = Math.min((now - start) / duration, 1);
		const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
		callback(Math.round(from + (to - from) * eased));
		if (p < 1) requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
}

export function normalizeUrl(url: string): string {
	let u = url.trim();
	if (!u.startsWith('http')) u = 'https://' + u;
	return u;
}

export function extractDomain(url: string): string {
	return url.replace('https://', '').replace('http://', '').split('/')[0];
}

export function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

export function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}
