import { describe, it, expect } from 'vitest';
import {
	scoreLevel,
	scoreLevelText,
	scoreColor,
	normalizeUrl,
	extractDomain,
	formatDate,
	clamp
} from '$lib/utils/score';

describe('scoreLevel', () => {
	it('returns excellent for 80+', () => {
		expect(scoreLevel(80)).toBe('excellent');
		expect(scoreLevel(100)).toBe('excellent');
		expect(scoreLevel(95)).toBe('excellent');
	});

	it('returns good for 60-79', () => {
		expect(scoreLevel(60)).toBe('good');
		expect(scoreLevel(79)).toBe('good');
	});

	it('returns warning for 40-59', () => {
		expect(scoreLevel(40)).toBe('warning');
		expect(scoreLevel(59)).toBe('warning');
	});

	it('returns poor for < 40', () => {
		expect(scoreLevel(0)).toBe('poor');
		expect(scoreLevel(39)).toBe('poor');
	});
});

describe('scoreLevelText', () => {
	it('returns human-readable text', () => {
		expect(scoreLevelText(90)).toBe('Excellent');
		expect(scoreLevelText(65)).toBe('Good');
		expect(scoreLevelText(45)).toBe('Warning');
		expect(scoreLevelText(20)).toBe('Poor');
	});
});

describe('scoreColor', () => {
	it('returns CSS variable for each level', () => {
		expect(scoreColor(90)).toContain('success');
		expect(scoreColor(65)).toContain('info');
		expect(scoreColor(45)).toContain('warning');
		expect(scoreColor(20)).toContain('danger');
	});
});

describe('normalizeUrl', () => {
	it('adds https:// if missing', () => {
		expect(normalizeUrl('example.com')).toBe('https://example.com');
	});

	it('keeps existing http://', () => {
		expect(normalizeUrl('http://example.com')).toBe('http://example.com');
	});

	it('keeps existing https://', () => {
		expect(normalizeUrl('https://example.com')).toBe('https://example.com');
	});

	it('trims whitespace', () => {
		expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
	});
});

describe('extractDomain', () => {
	it('extracts domain from URL', () => {
		expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
	});

	it('handles http://', () => {
		expect(extractDomain('http://test.com')).toBe('test.com');
	});

	it('handles bare domains', () => {
		expect(extractDomain('example.com/page')).toBe('example.com');
	});
});

describe('formatDate', () => {
	it('formats ISO date string', () => {
		const result = formatDate('2026-03-15T12:00:00Z');
		expect(result).toContain('Mar');
		expect(result).toContain('2026');
	});
});

describe('clamp', () => {
	it('clamps below min', () => {
		expect(clamp(-5, 0, 100)).toBe(0);
	});

	it('clamps above max', () => {
		expect(clamp(150, 0, 100)).toBe(100);
	});

	it('leaves values in range', () => {
		expect(clamp(50, 0, 100)).toBe(50);
	});
});
