import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Skip security headers in dev — Vite HMR needs eval/inline scripts
	if (dev) return response;

	// ── Security Headers (production only) ─────────────────
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' https://api-bscan.balancewises.io https://www.google.com/s2/favicons data: blob:",
			"connect-src 'self' https://api-bscan.balancewises.io https://fonts.googleapis.com https://fonts.gstatic.com",
			"frame-src 'none'",
			"form-action 'self'",
			"base-uri 'self'",
			"object-src 'none'"
		].join('; ')
	);
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

	return response;
};
