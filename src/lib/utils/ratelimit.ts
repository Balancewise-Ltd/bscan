/**
 * BSCAN Client-Side Rate Limiting & Debounce
 */

/** Debounce a function — delays execution until after `ms` of no calls */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	ms: number
): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout>;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
}

/** Throttle a function — max one call per `ms` */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	ms: number
): (...args: Parameters<T>) => void {
	let lastCall = 0;
	return (...args) => {
		const now = Date.now();
		if (now - lastCall >= ms) {
			lastCall = now;
			fn(...args);
		}
	};
}

/**
 * Simple cooldown tracker for buttons.
 * Usage:
 *   const scanCooldown = createCooldown(3000);
 *   if (scanCooldown.canFire()) { scanCooldown.fire(); doScan(); }
 */
export function createCooldown(cooldownMs: number) {
	let lastFired = 0;

	return {
		canFire(): boolean {
			return Date.now() - lastFired >= cooldownMs;
		},
		fire(): void {
			lastFired = Date.now();
		},
		remainingMs(): number {
			return Math.max(0, cooldownMs - (Date.now() - lastFired));
		},
		reset(): void {
			lastFired = 0;
		}
	};
}
