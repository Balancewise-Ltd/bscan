import { describe, it, expect } from 'vitest';
import {
	sanitize,
	sanitizeAttr,
	stripHtml,
	sanitizeWithBreaks,
	isSafeUrl,
	sanitizeUrl,
	safeRedirect,
	isValidEmail,
	passwordStrength,
	maskToken,
	clampString,
	safeGetStorage,
	safeSetStorage,
	safeRemoveStorage,
	safeFaviconUrl,
	safeJsonParse
} from '$lib/utils/security';

// ══════════════════════════════════════════════════════════
// HTML Sanitization
// ══════════════════════════════════════════════════════════

describe('sanitize', () => {
	it('escapes HTML entities', () => {
		expect(sanitize('<script>alert("xss")</script>')).toBe(
			'&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
		);
	});

	it('escapes ampersands', () => {
		expect(sanitize('a & b')).toBe('a &amp; b');
	});

	it('escapes backticks', () => {
		expect(sanitize('`code`')).toBe('&#96;code&#96;');
	});

	it('escapes single quotes', () => {
		expect(sanitize("it's")).toBe('it&#x27;s');
	});

	it('returns empty string for null/undefined', () => {
		expect(sanitize(null)).toBe('');
		expect(sanitize(undefined)).toBe('');
		expect(sanitize('')).toBe('');
	});

	it('handles nested injection attempts', () => {
		expect(sanitize('<img src=x onerror=alert(1)>')).toContain('&lt;img');
	});

	it('escapes event handler injection via quote escaping', () => {
		const input = '" onmouseover="alert(1)" data-x="';
		const result = sanitize(input);
		// Quotes are escaped so the handler can never execute in an attribute context
		expect(result).toContain('&quot;');
		expect(result).not.toContain('="alert');
	});
});

describe('sanitizeAttr', () => {
	it('escapes attribute-specific characters', () => {
		expect(sanitizeAttr('" onload="alert(1)')).not.toContain('"');
	});

	it('returns empty for null', () => {
		expect(sanitizeAttr(null)).toBe('');
	});
});

describe('stripHtml', () => {
	it('removes all HTML tags', () => {
		expect(stripHtml('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
	});

	it('handles script tags', () => {
		expect(stripHtml('<script>alert(1)</script>text')).toBe('alert(1)text');
	});

	it('returns empty for null', () => {
		expect(stripHtml(null)).toBe('');
	});
});

describe('sanitizeWithBreaks', () => {
	it('converts newlines to <br> after sanitizing', () => {
		expect(sanitizeWithBreaks('line1\nline2')).toBe('line1<br>line2');
	});

	it('sanitizes before converting breaks', () => {
		expect(sanitizeWithBreaks('<script>\nalert(1)')).toContain('&lt;script&gt;<br>');
	});
});

// ══════════════════════════════════════════════════════════
// URL Validation
// ══════════════════════════════════════════════════════════

describe('isSafeUrl', () => {
	it('allows http URLs', () => {
		expect(isSafeUrl('http://example.com')).toBe(true);
	});

	it('allows https URLs', () => {
		expect(isSafeUrl('https://example.com')).toBe(true);
	});

	it('blocks javascript: protocol', () => {
		expect(isSafeUrl('javascript:alert(1)')).toBe(false);
	});

	it('blocks data: protocol', () => {
		expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
	});

	it('blocks vbscript: protocol', () => {
		expect(isSafeUrl('vbscript:msgbox("xss")')).toBe(false);
	});

	it('blocks empty string', () => {
		expect(isSafeUrl('')).toBe(false);
	});

	it('blocks relative paths', () => {
		expect(isSafeUrl('/malicious/path')).toBe(false);
	});
});

describe('sanitizeUrl', () => {
	it('returns safe URLs unchanged', () => {
		expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
	});

	it('returns empty for dangerous URLs', () => {
		expect(sanitizeUrl('javascript:alert(1)')).toBe('');
	});

	it('returns empty for null', () => {
		expect(sanitizeUrl(null)).toBe('');
	});

	it('trims whitespace', () => {
		expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
	});
});

// ══════════════════════════════════════════════════════════
// Redirect Protection
// ══════════════════════════════════════════════════════════

describe('safeRedirect', () => {
	it('allows Stripe checkout URLs', () => {
		expect(safeRedirect('https://checkout.stripe.com/c/pay/cs_test_123')).toBeTruthy();
	});

	it('allows Stripe billing portal', () => {
		expect(safeRedirect('https://billing.stripe.com/p/session/test_123')).toBeTruthy();
	});

	it('allows BSCAN URLs', () => {
		expect(safeRedirect('https://bscan.balancewises.io/account')).toBeTruthy();
	});

	it('allows Google OAuth for GSC', () => {
		expect(safeRedirect('https://accounts.google.com/o/oauth2/v2/auth?client_id=123')).toBeTruthy();
	});

	it('blocks unknown domains', () => {
		expect(safeRedirect('https://evil-phishing-site.com/steal-credentials')).toBeNull();
	});

	it('blocks javascript: protocol', () => {
		expect(safeRedirect('javascript:alert(document.cookie)')).toBeNull();
	});

	it('blocks data: protocol', () => {
		expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBeNull();
	});

	it('returns null for empty', () => {
		expect(safeRedirect('')).toBeNull();
		expect(safeRedirect(null)).toBeNull();
		expect(safeRedirect(undefined)).toBeNull();
	});

	it('blocks subdomain spoofing', () => {
		expect(safeRedirect('https://stripe.com.evil.com/steal')).toBeNull();
	});
});

// ══════════════════════════════════════════════════════════
// Email Validation
// ══════════════════════════════════════════════════════════

describe('isValidEmail', () => {
	it('accepts valid emails', () => {
		expect(isValidEmail('user@example.com')).toBe(true);
		expect(isValidEmail('test.user@company.co.uk')).toBe(true);
	});

	it('rejects invalid emails', () => {
		expect(isValidEmail('')).toBe(false);
		expect(isValidEmail('notanemail')).toBe(false);
		expect(isValidEmail('@no-local.com')).toBe(false);
		expect(isValidEmail('no-domain@')).toBe(false);
		expect(isValidEmail('spaces in@email.com')).toBe(false);
	});
});

// ══════════════════════════════════════════════════════════
// Password Strength
// ══════════════════════════════════════════════════════════

describe('passwordStrength', () => {
	it('weak for < 8 chars', () => {
		expect(passwordStrength('short')).toBe('weak');
	});

	it('fair for simple 8+ chars', () => {
		expect(passwordStrength('abcdefgh')).toBe('fair');
	});

	it('good for mixed case + digits', () => {
		expect(passwordStrength('Abcdef12')).toBe('good');
	});

	it('strong for mixed case + digits + symbols + 12+ chars', () => {
		expect(passwordStrength('Str0ng!Pass#2026')).toBe('strong');
	});
});

// ══════════════════════════════════════════════════════════
// Token Safety
// ══════════════════════════════════════════════════════════

describe('maskToken', () => {
	it('masks middle of token', () => {
		const result = maskToken('abcdefghijklmnop');
		expect(result).toBe('abcd••••mnop');
		expect(result).not.toContain('efgh');
	});

	it('handles short tokens', () => {
		expect(maskToken('abc')).toBe('••••••••');
	});

	it('handles empty', () => {
		expect(maskToken('')).toBe('••••••••');
	});
});

// ══════════════════════════════════════════════════════════
// String Clamping
// ══════════════════════════════════════════════════════════

describe('clampString', () => {
	it('truncates long strings', () => {
		expect(clampString('hello world', 5)).toBe('hello');
	});

	it('leaves short strings alone', () => {
		expect(clampString('hi', 10)).toBe('hi');
	});

	it('handles empty', () => {
		expect(clampString('', 5)).toBe('');
	});
});

// ══════════════════════════════════════════════════════════
// Safe localStorage
// ══════════════════════════════════════════════════════════

describe('safeGetStorage', () => {
	it('gets values', () => {
		localStorage.setItem('test', 'value');
		expect(safeGetStorage('test')).toBe('value');
	});

	it('returns null for missing keys', () => {
		expect(safeGetStorage('nonexistent')).toBeNull();
	});
});

describe('safeSetStorage', () => {
	it('sets values', () => {
		safeSetStorage('key', 'val');
		expect(localStorage.getItem('key')).toBe('val');
	});
});

describe('safeRemoveStorage', () => {
	it('removes values', () => {
		localStorage.setItem('del', 'me');
		safeRemoveStorage('del');
		expect(localStorage.getItem('del')).toBeNull();
	});
});

// ══════════════════════════════════════════════════════════
// Favicon Safety
// ══════════════════════════════════════════════════════════

describe('safeFaviconUrl', () => {
	it('returns Google favicon URL', () => {
		const url = safeFaviconUrl('example.com');
		expect(url).toContain('google.com/s2/favicons');
		expect(url).toContain('example.com');
	});

	it('strips dangerous characters', () => {
		const url = safeFaviconUrl('<script>alert(1)</script>');
		expect(url).not.toContain('<script>');
	});
});

// ══════════════════════════════════════════════════════════
// Safe JSON Parse (prototype pollution protection)
// ══════════════════════════════════════════════════════════

describe('safeJsonParse', () => {
	it('parses valid JSON', () => {
		expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
	});

	it('returns fallback for invalid JSON', () => {
		expect(safeJsonParse('not json', [])).toEqual([]);
	});

	it('blocks __proto__ pollution', () => {
		const result = safeJsonParse('{"__proto__":{"admin":true}}', {});
		expect(result).toEqual({});
	});

	it('blocks constructor pollution', () => {
		const result = safeJsonParse('{"constructor":{"prototype":{}}}', {});
		expect(result).toEqual({});
	});

	it('returns fallback for non-objects', () => {
		expect(safeJsonParse('"string"', {})).toEqual({});
		expect(safeJsonParse('42', {})).toEqual({});
	});
});
