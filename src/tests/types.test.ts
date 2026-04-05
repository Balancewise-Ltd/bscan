import { describe, it, expect } from 'vitest';
import { PLAN_PRICING, PLAN_LIMITS, SCORE_CATEGORIES } from '$lib/types';

describe('PLAN_PRICING', () => {
	it('has pro pricing', () => {
		expect(PLAN_PRICING.pro.monthly).toBe(9);
		expect(PLAN_PRICING.pro.annual).toBe(7);
	});

	it('has agency pricing', () => {
		expect(PLAN_PRICING.agency.monthly).toBe(29);
		expect(PLAN_PRICING.agency.annual).toBe(23);
	});

	it('annual is cheaper than monthly', () => {
		expect(PLAN_PRICING.pro.annual).toBeLessThan(PLAN_PRICING.pro.monthly);
		expect(PLAN_PRICING.agency.annual).toBeLessThan(PLAN_PRICING.agency.monthly);
	});
});

describe('PLAN_LIMITS', () => {
	it('free has 3 scans', () => {
		expect(PLAN_LIMITS.free.scans).toBe(3);
	});

	it('pro has 30 scans', () => {
		expect(PLAN_LIMITS.pro.scans).toBe(30);
	});

	it('agency has unlimited', () => {
		expect(PLAN_LIMITS.agency.scans).toBe(Infinity);
	});

	it('all plans have labels', () => {
		expect(PLAN_LIMITS.free.label).toBe('Free');
		expect(PLAN_LIMITS.pro.label).toBe('Starter');
		expect(PLAN_LIMITS.agency.label).toBe('Agency');
	});
});

describe('SCORE_CATEGORIES', () => {
	it('has 6 categories', () => {
		expect(SCORE_CATEGORIES).toHaveLength(6);
	});

	it('includes all required keys', () => {
		const keys = SCORE_CATEGORIES.map((c) => c.key);
		expect(keys).toContain('seo');
		expect(keys).toContain('performance');
		expect(keys).toContain('accessibility');
		expect(keys).toContain('security');
		expect(keys).toContain('mobile');
		expect(keys).toContain('links');
	});

	it('each has key, label, and icon', () => {
		SCORE_CATEGORIES.forEach((cat) => {
			expect(cat.key).toBeTruthy();
			expect(cat.label).toBeTruthy();
			expect(cat.icon).toBeTruthy();
		});
	});
});
