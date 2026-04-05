import { writable, derived } from 'svelte/store';
import { disconnectWS } from './wisers-ws';
import type { User, Plan } from '$lib/types';
import { safeGetStorage, safeSetStorage, safeRemoveStorage } from '$lib/utils/security';
import * as api from '$lib/api/client';
import { hasKeyPair, generateAndStoreKeyPair, uploadPublicKey } from './encryption';

const _user = writable<User | null>(null);
const _token = writable<string | null>(null);
const _loading = writable(true);

// Combined derived store — this is what $auth reads from
const _store = derived(
	[_user, _token, _loading],
	([$user, $token, $loading]) => ({
		user: $user,
		token: $token,
		loading: $loading,
		isLoggedIn: $user !== null,
		plan: ($user?.plan ?? 'guest') as Plan,
		isPaid: $user?.plan === 'pro' || $user?.plan === 'agency',
		isAgency: $user?.plan === 'agency'
	})
);

async function init() {
	if (typeof window === 'undefined') { _loading.set(false); return; }
	const savedToken = safeGetStorage('bscan_token');
	if (!savedToken) { _loading.set(false); return; }
	_token.set(savedToken);
	try {
		const me = await api.getMe();
		_user.set(me);
	} catch {
		safeRemoveStorage('bscan_token');
	disconnectWS();
		_token.set(null);
	}
	_loading.set(false);
}

async function login(email: string, password: string, totp_code?: string) {
	const result = await api.login(email, password, totp_code);
	if (result.requires_2fa) return result;
	if (result.requires_verification) return result;
	safeSetStorage('bscan_token', result.access_token);
	if (result.refresh_token) safeSetStorage('bscan_refresh_token', result.refresh_token);
	safeSetStorage('bscan_email', email);
	_token.set(result.access_token);
	_user.set(result.user);
	// Save profile snapshot for quick re-login after logout
	if (result.user) {
		safeSetStorage('bscan_saved_profile', JSON.stringify({
			email: result.user.email,
			display_name: result.user.display_name || result.user.name || '',
			avatar_url: result.user.avatar_url || ''
		}));
	}
	return result;
}

async function verifyLoginCode(email: string, code: string, save_login: boolean = true) {
	const result = await api.verifyLoginCode(email, code, save_login);
	safeSetStorage('bscan_token', result.access_token);
	if (result.refresh_token) safeSetStorage('bscan_refresh_token', result.refresh_token);
	safeSetStorage('bscan_email', email);
	// Store device trust token so next login skips email verification
	if ((result as any).device_token) {
		safeSetStorage('bscan_device_trust', (result as any).device_token);
	}
	_token.set(result.access_token);
	_user.set(result.user);
	// Save profile snapshot for quick re-login after logout
	if (result.user) {
		safeSetStorage('bscan_saved_profile', JSON.stringify({
			email: result.user.email,
			display_name: result.user.display_name || result.user.name || '',
			avatar_url: result.user.avatar_url || ''
		}));
	}
	return result;
}

async function register(email: string, password: string, name: string, referral_code: string = '', verification_code: string = '', date_of_birth: string = '') {
	const result = await api.register(email, password, name, referral_code, verification_code, date_of_birth);
	if (result.access_token) {
		safeSetStorage('bscan_token', result.access_token);
		if (result.refresh_token) safeSetStorage('bscan_refresh_token', result.refresh_token);
		safeSetStorage('bscan_email', email);
		_token.set(result.access_token);
		_user.set(result.user);
		// Generate E2E encryption keypair on registration
		if (!hasKeyPair()) {
			generateAndStoreKeyPair();
			uploadPublicKey(result.access_token).catch(() => {});
		}
	}
	return result;
}

function logout() {
	safeRemoveStorage('bscan_token');
	safeRemoveStorage('bscan_refresh_token');
	disconnectWS();
	safeRemoveStorage('bscan_email');
	safeRemoveStorage('bscan_name');
	// Keep bscan_saved_profile and bscan_device_trust so user sees
	// the "Continue as..." card and skips email code on next login
	_token.set(null);
	_user.set(null);
}

async function loginWithToken(accessToken: string, refreshToken?: string) {
	safeSetStorage('bscan_token', accessToken);
	if (refreshToken) safeSetStorage('bscan_refresh_token', refreshToken);
	_token.set(accessToken);
	try {
		const me = await api.getMe();
		_user.set(me);
		return true;
	} catch {
		safeRemoveStorage('bscan_token');
		safeRemoveStorage('bscan_refresh_token');
		_token.set(null);
		return false;
	}
}

async function refresh() {
	try {
		const me = await api.getMe();
		_user.set(me);
	} catch {
		logout();
	}
}

export const auth = {
	subscribe: _store.subscribe,
	init,
	login,
	verifyLoginCode,
	loginWithToken,
	register,
	logout,
	refresh
};
