/**
 * BSCAN Security Utilities
 * Prevents XSS, sanitizes user input, validates data shapes
 */

// ── HTML Sanitization ────────────────────────────────────
const ENTITY_MAP: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#x27;',
	'`': '&#96;'
};

/** Escape all HTML entities — use for ANY user-supplied text rendered as HTML */
export function sanitize(str: string | null | undefined): string {
	if (!str) return '';
	return String(str).replace(/[&<>"'`/]/g, (c) => ENTITY_MAP[c] || c);
}

/** Escape for use inside HTML attributes */
export function sanitizeAttr(str: string | null | undefined): string {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/** Strip all HTML tags — returns plain text only */
export function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return String(html).replace(/<[^>]*>/g, '');
}

/** Convert newlines to <br> after sanitizing */
export function sanitizeWithBreaks(str: string | null | undefined): string {
	return sanitize(str).replace(/\n/g, '<br>');
}

// ── URL Validation ───────────────────────────────────────
const SAFE_URL_REGEX = /^https?:\/\//i;
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

/** Validate URL is safe (http/https only) */
export function isSafeUrl(url: string): boolean {
	if (!url) return false;
	const trimmed = url.trim();
	if (DANGEROUS_PROTOCOLS.test(trimmed)) return false;
	return SAFE_URL_REGEX.test(trimmed);
}

/** Sanitize a URL — returns empty string if unsafe */
export function sanitizeUrl(url: string | null | undefined): string {
	if (!url) return '';
	const trimmed = url.trim();
	if (!isSafeUrl(trimmed)) return '';
	return trimmed;
}

// ── Redirect Protection ──────────────────────────────────
const TRUSTED_REDIRECT_DOMAINS = [
	'checkout.stripe.com',
	'billing.stripe.com',
	'bscan.balancewises.io',
	'balancewises.io',
	'api-bscan.balancewises.io',
	'accounts.google.com',	// for GSC OAuth
];

/** Validate a redirect URL is safe — only allows trusted domains */
export function safeRedirect(url: string | null | undefined): string | null {
	if (!url) return null;
	const trimmed = url.trim();
	if (!isSafeUrl(trimmed)) return null;
	try {
		const parsed = new URL(trimmed);
		const domain = parsed.hostname.toLowerCase();
		const isTrusted = TRUSTED_REDIRECT_DOMAINS.some(
			(d) => domain === d || domain.endsWith('.' + d)
		);
		if (!isTrusted) {
			console.warn(`[BSCAN Security] Blocked redirect to untrusted domain: ${domain}`);
			return null;
		}
		return trimmed;
	} catch {
		return null;
	}
}

// ── Email Validation ─────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	return EMAIL_REGEX.test(email.trim());
}

// ── Password Strength ────────────────────────────────────
export function passwordStrength(pw: string): 'weak' | 'fair' | 'good' | 'strong' {
	if (pw.length < 8) return 'weak';
	let score = 0;
	if (pw.length >= 12) score++;
	if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
	if (/\d/.test(pw)) score++;
	if (/[^a-zA-Z0-9]/.test(pw)) score++;
	if (score <= 1) return 'fair';
	if (score <= 2) return 'good';
	return 'strong';
}

// ── Token Safety ─────────────────────────────────────────
/** Never log or expose tokens — mask for display */
export function maskToken(token: string): string {
	if (!token || token.length < 8) return '••••••••';
	return token.substring(0, 4) + '••••' + token.substring(token.length - 4);
}

// ── Input Length Guards ──────────────────────────────────
export function clampString(str: string, maxLen: number): string {
	if (!str) return '';
	return str.length > maxLen ? str.substring(0, maxLen) : str;
}

// ── LocalStorage Safety ──────────────────────────────────
/** Safely get from localStorage with try/catch */
export function safeGetStorage(key: string): string | null {
	try {
		if (typeof window === 'undefined') return null;
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Safely set localStorage */
export function safeSetStorage(key: string, value: string): void {
	try {
		if (typeof window !== 'undefined') localStorage.setItem(key, value);
	} catch { /* quota exceeded or blocked */ }
}

/** Safely remove from localStorage */
export function safeRemoveStorage(key: string): void {
	try {
		if (typeof window !== 'undefined') localStorage.removeItem(key);
	} catch { /* blocked */ }
}

// ── Content Security ─────────────────────────────────────
/** Check if a domain looks safe for favicon fetching */
export function safeFaviconUrl(domain: string): string {
	const clean = sanitize(domain).replace(/[^a-zA-Z0-9.\-]/g, '');
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=32`;
}

/** Prevent prototype pollution in JSON parsing */
export function safeJsonParse<T>(json: string, fallback: T): T {
	try {
		const parsed = JSON.parse(json);
		if (typeof parsed !== 'object' || parsed === null) return fallback;
		// Block __proto__ pollution — check OWN properties only (not prototype chain)
		if (
			Object.prototype.hasOwnProperty.call(parsed, '__proto__') ||
			Object.prototype.hasOwnProperty.call(parsed, 'constructor') ||
			Object.prototype.hasOwnProperty.call(parsed, 'prototype')
		) {
			return fallback;
		}
		return parsed as T;
	} catch {
		return fallback;
	}
}
