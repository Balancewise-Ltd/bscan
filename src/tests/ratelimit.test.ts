import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle, createCooldown } from '$lib/utils/ratelimit';

describe('debounce', () => {
	it('delays execution', () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		debounced();
		debounced();

		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);

		vi.useRealTimers();
	});

	it('resets timer on each call', () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		vi.advanceTimersByTime(50);
		debounced(); // resets
		vi.advanceTimersByTime(50);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledTimes(1);

		vi.useRealTimers();
	});
});

describe('throttle', () => {
	it('fires immediately then blocks', () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 100);

		throttled();
		expect(fn).toHaveBeenCalledTimes(1);

		throttled();
		throttled();
		expect(fn).toHaveBeenCalledTimes(1); // still blocked
	});

	it('allows after cooldown', async () => {
		const fn = vi.fn();
		const throttled = throttle(fn, 50);

		throttled();
		expect(fn).toHaveBeenCalledTimes(1);

		await new Promise((r) => setTimeout(r, 60));

		throttled();
		expect(fn).toHaveBeenCalledTimes(2);
	});
});

describe('createCooldown', () => {
	it('allows first fire', () => {
		const cd = createCooldown(1000);
		expect(cd.canFire()).toBe(true);
	});

	it('blocks during cooldown', () => {
		const cd = createCooldown(1000);
		cd.fire();
		expect(cd.canFire()).toBe(false);
	});

	it('allows after cooldown expires', async () => {
		const cd = createCooldown(50);
		cd.fire();
		expect(cd.canFire()).toBe(false);

		await new Promise((r) => setTimeout(r, 60));
		expect(cd.canFire()).toBe(true);
	});

	it('reports remaining time', () => {
		const cd = createCooldown(1000);
		cd.fire();
		const remaining = cd.remainingMs();
		expect(remaining).toBeGreaterThan(0);
		expect(remaining).toBeLessThanOrEqual(1000);
	});

	it('reset clears cooldown', () => {
		const cd = createCooldown(1000);
		cd.fire();
		expect(cd.canFire()).toBe(false);
		cd.reset();
		expect(cd.canFire()).toBe(true);
	});
});
