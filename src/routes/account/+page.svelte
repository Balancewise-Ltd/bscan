<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { formatDate, scoreColor } from '$lib/utils/score';
	import { safeFaviconUrl, safeGetStorage, safeSetStorage, safeRedirect, isValidEmail } from '$lib/utils/security';
	import * as api from '$lib/api/client';
	import type { ScanResult } from '$lib/types';
	import Seo from '$lib/components/ui/Seo.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	// ── Auth form state ──────────────────────────────────
	let isRegister = $state(false);
	let authEmail = $state('');
	let authPassword = $state('');
	let authName = $state('');
	let authError = $state('');
	let authLoading = $state(false);

	// ── Forgot / Reset Password ─────────────────────────
	let showForgot = $state(false);
	let forgotEmail = $state('');
	let forgotLoading = $state(false);
	let forgotMsg = $state('');
	let forgotError = $state('');
	let resetToken = $state('');
	let resetNewPw = $state('');
	let resetConfirm = $state('');
	let resetLoading = $state(false);
	let resetMsg = $state('');
	let resetError = $state('');

	// ── Email Verification ───────────────────────────────
	let verifyLoading = $state(false);
	let verifyMsg = $state('');
	let verifyError = $state('');
	let resendLoading = $state(false);

	// ── Referral System ─────────────────────────────────
	let referralData = $state<any>(null);
	let referralLoading = $state(true);
	let claimLoading = $state(false);
	let claimMsg = $state('');

	// ── Dashboard tabs ───────────────────────────────────
	type Tab = 'overview' | 'profile' | 'billing' | 'history' | 'api-keys' | 'security' | 'branding';
	let activeTab = $state<Tab>('overview');

	// ── Profile state ────────────────────────────────────
	let profileData = $state<api.ProfileData>({});
	let profileSaving = $state(false);
	let profileMsg = $state('');
	let usernameCheck = $state('');

	// ── Billing state ────────────────────────────────────
	let promoCode = $state('');
	let promoLoading = $state(false);
	let promoMsg = $state('');
	let promoError = $state('');
	let portalLoading = $state(false);

	// ── History state ────────────────────────────────────
	let historyItems = $state<ScanResult[]>([]);
	let historyLoading = $state(false);
	let historyCursor = $state<string | null>(null);
	let historyHasMore = $state(false);

	// ── API Keys state ───────────────────────────────────
	let apiKeys = $state<any[]>([]);
	let newKeyName = $state('');
	let newKeyResult = $state<string | null>(null);

	// ── Password state ───────────────────────────────────
	let pwCurrent = $state('');
	let pwNew = $state('');
	let pwConfirm = $state('');
	let pwError = $state('');
	let pwSuccess = $state('');

	// ── Branding state (Agency white-label) ────────────────
	let brandName = $state('');
	let brandColor = $state('#f0a500');
	let brandLogoUrl = $state('');
	let brandSaving = $state(false);
	let brandMsg = $state('');

	// Avatar state (for instant update after upload)
	let avatarUrl = $state('');

	// ── Push Notification state ─────────────────────────
	let pushSupported = $state(false);
	let pushPermission = $state<string>('default');
	let pushEnabled = $state(false);
	let pushLoading = $state(false);
	let pushToken = $state<string | null>(null);
	let pushMsg = $state('');
	let pushError = $state('');
	let pushTestLoading = $state(false);

	async function saveBranding() {
		if (!user) return;
		brandSaving = true;
		brandMsg = '';
		try {
			await api.updateProfile(user.email, {
				brand_name: brandName,
				brand_color: brandColor,
				brand_logo_url: brandLogoUrl,
			});
			brandMsg = 'Branding saved! Your next PDF will use these settings.';
		} catch (err) {
			brandMsg = err instanceof Error ? err.message : 'Failed to save.';
		}
		brandSaving = false;
	}

	const user = $derived($auth.user);
	const plan = $derived(user?.plan || 'free');
	const planLabel = $derived(plan.charAt(0).toUpperCase() + plan.slice(1));
	const isPaid = $derived(plan === 'pro' || plan === 'agency');
	const isAgency = $derived(plan === 'agency');

	onMount(() => {
		const saved = safeGetStorage('bscan_email');
		if (saved) authEmail = saved;
		if (user) loadDashboard();

		// Handle password reset link
		const params = new URLSearchParams(window.location.search);
		const rt = params.get('reset_token');
		if (rt) {
			resetToken = rt;
			window.history.replaceState({}, '', '/account');
		}

		// Handle email verification link
		const vt = params.get('verify');
		if (vt) {
			handleEmailVerify(vt);
			window.history.replaceState({}, '', '/account');
		}

		// Init push notification state
		initPushState();
	});

	// Watch for auth changes — load profile for ALL tabs
	$effect(() => {
		if (user && activeTab === 'overview') { loadHistory(); if (isPaid) loadApiKeys(); }
		if (user && !profileLoaded) loadProfileData();
		if (user && referralLoading) {
			api.referralStats().then(d => { referralData = d; referralLoading = false; }).catch(() => { referralLoading = false; });
		}
	});

	let profileLoaded = $state(false);

	async function loadProfileData() {
		try {
			const profile = await api.getProfile();
			if (profile) {
				profileData.username = profile.username || '';
				profileData.display_name = profile.display_name || '';
				profileData.company = profile.company || '';
				profileData.website = profile.website || '';
				profileData.phone = profile.phone || '';
				profileData.city = profile.city || '';
				profileData.postcode = profile.postcode || '';
				profileData.country = profile.country || '';
				profileData.bio = profile.bio || '';
				profileData.address_line1 = profile.address_line1 || '';
				profileData.address_line2 = profile.address_line2 || '';
				profileData.brand_name = profile.brand_name || '';
				profileData.brand_color = profile.brand_color || '';
				profileData.brand_logo_url = profile.brand_logo_url || '';
				avatarUrl = profile.avatar_url || '';
				brandName = profile.brand_name || '';
				brandColor = profile.brand_color || '#f0a500';
				brandLogoUrl = profile.brand_logo_url || '';
				profileLoaded = true;
			}
		} catch {}
	}

	async function loadDashboard() {
		loadHistory();
		if (isPaid) loadApiKeys();
	}

	// ── Auth ─────────────────────────────────────────────
	function getDomain(url: string | undefined): string {
		if (!url) return '';
		return url.replace('https://', '').replace('http://', '').split('/')[0];
	}

	async function handleAuth() {
		authError = '';
		if (!authEmail || !authPassword) { authError = 'Fill in all fields.'; return; }
		if (isRegister && !authName) { authError = 'Name is required.'; return; }
		authLoading = true;
		try {
			if (isRegister) {
				await auth.register(authEmail, authPassword, authName);
			} else {
				await auth.login(authEmail, authPassword);
			}
			loadDashboard();
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Authentication failed.';
		}
		authLoading = false;
	}

	// ── Profile ──────────────────────────────────────────
	async function saveProfile() {
		if (!user) return;
		profileMsg = '';

		// Required field validation
		const required: { field: string; label: string }[] = [
			{ field: 'display_name', label: 'Display Name' },
			{ field: 'company', label: 'Company' },
			{ field: 'phone', label: 'Phone' },
			{ field: 'postcode', label: 'Postcode' },
			{ field: 'address_line1', label: 'Address Line 1' },
			{ field: 'city', label: 'City' },
			{ field: 'country', label: 'Country' },
		];
		const missing = required.filter(r => !(profileData as any)[r.field]?.trim());
		if (missing.length > 0) {
			profileMsg = `Required: ${missing.map(m => m.label).join(', ')}`;
			return;
		}

		profileSaving = true;
		try {
			await api.updateProfile(user.email, profileData);
			profileMsg = 'Profile updated!';
			auth.refresh();
		} catch (err) {
			profileMsg = err instanceof Error ? err.message : 'Failed.';
		}
		profileSaving = false;
	}

	// ── Name Change Request ──────────────────────────────
	let nameChangeInput = $state('');
	let nameChangeMsg = $state('');
	let nameChangeSending = $state(false);
	let showNameChange = $state(false);

	async function requestNameChange() {
		if (!nameChangeInput.trim() || nameChangeInput.trim().length > 100) {
			nameChangeMsg = 'Name must be 1-100 characters.';
			return;
		}
		nameChangeSending = true;
		nameChangeMsg = '';
		try {
			const res = await api.requestNameChange(nameChangeInput.trim());
			nameChangeMsg = res.message || 'Request sent! Admin will review within 24 hours.';
			showNameChange = false;
		} catch (err) {
			nameChangeMsg = err instanceof Error ? err.message : 'Failed to send request.';
		}
		nameChangeSending = false;
	}

	// ── Postcode Lookup ──────────────────────────────────
	async function lookupPostcode() {
		const pc = profileData.postcode?.trim().replace(/\s/g, '');
		if (!pc || pc.length < 3) return;
		profileMsg = 'Looking up address...';
		try {
			// 1. Get city + country from postcodes.io
			const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
			const data = await res.json();
			if (data.status === 200 && data.result) {
				const r = data.result;
				profileData.city = r.admin_district || r.parish || '';
				profileData.country = r.country || 'United Kingdom';
			}

			// 2. Get street from OpenStreetMap Nominatim (free, no key)
			const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pc)}&country=gb&format=json&addressdetails=1&limit=1`, {
				headers: { 'User-Agent': 'BSCAN/1.0 (bscan.balancewises.io)' }
			});
			const nomData = await nomRes.json();
			if (nomData.length > 0 && nomData[0].address) {
				const addr = nomData[0].address;
				const street = addr.road || addr.pedestrian || addr.footway || '';
				if (street && !profileData.address_line1) {
					profileData.address_line1 = street;
				}
				// Fill city from Nominatim if postcodes.io missed it
				if (!profileData.city) {
					profileData.city = addr.city || addr.town || addr.village || '';
				}
			}

			profileMsg = `Detected: ${profileData.address_line1 ? profileData.address_line1 + ', ' : ''}${profileData.city}, ${profileData.country}. Add your house number.`;
		} catch {
			profileMsg = 'Could not detect address. Enter manually.';
		}
	}

	async function handleUsernameCheck() {
		const u = profileData.username?.trim();
		if (!u || u.length < 3) { usernameCheck = ''; return; }
		try {
			const res = await api.checkUsername(u);
			usernameCheck = res.available ? '✓ Available' : `✗ ${res.reason || 'Taken'}`;
		} catch { usernameCheck = ''; }
	}

	// ── Billing ──────────────────────────────────────────
	async function redeemPromo() {
		promoError = ''; promoMsg = '';
		if (!promoCode.trim()) return;
		promoLoading = true;
		try {
			const res = await api.redeemPromo(promoCode.trim());
			promoMsg = res.message;
			promoCode = '';
			auth.refresh();
		} catch (err) {
			promoError = err instanceof Error ? err.message : 'Invalid code.';
		}
		promoLoading = false;
	}

	let billingError = $state('');

	async function openBillingPortal() {
		portalLoading = true;
		billingError = '';
		try {
			const res = await api.createBillingPortal();
			const safe = safeRedirect(res.url);
			if (safe) window.location.href = safe;
			else billingError = 'Could not open billing portal.';
		} catch (err) {
			billingError = 'Billing portal unavailable. If you subscribed recently, contact support@balancewises.io to manage your subscription.';
		}
		portalLoading = false;
	}

	// ── History ──────────────────────────────────────────
	async function loadHistory() {
		historyLoading = true;
		try {
			const res = await api.getScanHistory(undefined, 20);
			historyItems = res.items || [];
			historyCursor = res.next_cursor;
			historyHasMore = res.has_more;
		} catch { historyItems = []; }
		historyLoading = false;
	}

	async function loadMoreHistory() {
		if (!historyCursor) return;
		historyLoading = true;
		try {
			const res = await api.getScanHistory(historyCursor, 20);
			historyItems = [...historyItems, ...(res.items || [])];
			historyCursor = res.next_cursor;
			historyHasMore = res.has_more;
		} catch { }
		historyLoading = false;
	}

	// ── API Keys ─────────────────────────────────────────
	async function loadApiKeys() {
		try { apiKeys = await api.listApiKeys(); } catch { apiKeys = []; }
	}

	async function createKey() {
		if (!newKeyName.trim()) return;
		try {
			const res = await api.createApiKey(newKeyName);
			newKeyResult = res.key || res.api_key || JSON.stringify(res);
			newKeyName = '';
			loadApiKeys();
		} catch { }
	}

	async function revokeKey(id: string) {
		if (!confirm('Revoke this API key? This cannot be undone.')) return;
		try { await api.revokeApiKey(id); loadApiKeys(); } catch { }
	}

	// ── Password ─────────────────────────────────────────
	async function changePassword() {
		pwError = ''; pwSuccess = '';
		if (!pwCurrent || !pwNew || !pwConfirm) { pwError = 'All fields required.'; return; }
		if (pwNew.length < 8) { pwError = 'Must be 8+ characters.'; return; }
		if (pwNew !== pwConfirm) { pwError = 'Passwords do not match.'; return; }
		try {
			await api.changePassword(pwCurrent, pwNew);
			pwSuccess = 'Password changed successfully!';
			pwCurrent = ''; pwNew = ''; pwConfirm = '';
		} catch (err) {
			pwError = err instanceof Error ? err.message : 'Failed.';
		}
	}

	function kd(e: KeyboardEvent) { if (e.key === 'Enter') handleAuth(); }

	async function handleForgotPassword() {
		if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
			forgotError = 'Enter a valid email address.';
			return;
		}
		forgotLoading = true;
		forgotError = '';
		forgotMsg = '';
		try {
			await api.forgotPassword(forgotEmail.trim());
			forgotMsg = 'If that email exists, a reset link has been sent. Check your inbox.';
		} catch (err) {
			forgotError = err instanceof Error ? err.message : 'Something went wrong.';
		}
		forgotLoading = false;
	}

	async function handleResetPassword() {
		resetError = '';
		if (resetNewPw.length < 8) { resetError = 'Password must be at least 8 characters.'; return; }
		if (resetNewPw !== resetConfirm) { resetError = 'Passwords do not match.'; return; }
		resetLoading = true;
		try {
			const res = await api.resetPassword(resetToken, resetNewPw);
			resetMsg = res.message || 'Password reset successfully! You can now sign in.';
			resetToken = '';
		} catch (err) {
			resetError = err instanceof Error ? err.message : 'Reset failed. Link may have expired.';
		}
		resetLoading = false;
	}

	async function handleEmailVerify(token: string) {
		verifyLoading = true;
		verifyError = '';
		verifyMsg = '';
		try {
			const res = await api.verifyEmail(token);
			verifyMsg = res.message || 'Email verified successfully!';
			auth.refresh();
		} catch (err) {
			verifyError = err instanceof Error ? err.message : 'Verification failed. Link may be invalid or expired.';
		}
		verifyLoading = false;
	}

	async function handleResendVerification() {
		resendLoading = true;
		verifyError = '';
		verifyMsg = '';
		try {
			const res = await api.resendVerification();
			verifyMsg = res.message || 'Verification email sent!';
		} catch (err) {
			verifyError = err instanceof Error ? err.message : 'Failed to resend.';
		}
		resendLoading = false;
	}

	// ── Push Notification handlers ──────────────────────
	async function initPushState() {
		try {
			const { isPushSupported, getPushPermission } = await import('$lib/utils/push');
			pushSupported = isPushSupported();
			pushPermission = getPushPermission() as string;
			// Check if we have a saved token — means they opted in before
			const savedToken = safeGetStorage('bscan_push_token');
			if (savedToken && pushPermission === 'granted') {
				pushEnabled = true;
				pushToken = savedToken;
			}
		} catch {
			pushSupported = false;
		}
	}

	async function togglePush() {
		if (pushEnabled) {
			await disablePush();
		} else {
			await enablePush();
		}
	}

	async function enablePush() {
		pushLoading = true;
		pushError = '';
		pushMsg = '';
		try {
			const { requestPushPermission, VAPID_KEY } = await import('$lib/utils/push');
			const token = await requestPushPermission(VAPID_KEY);
			if (!token) {
				pushError = 'Permission denied or not supported. Check your browser notification settings.';
				pushLoading = false;
				return;
			}
			await api.registerPushToken(token);
			pushToken = token;
			pushEnabled = true;
			safeSetStorage('bscan_push_token', token);
			pushMsg = 'Push notifications enabled! You\'ll receive alerts when your site scores change.';
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Failed to enable push notifications.';
		}
		pushLoading = false;
	}

	async function disablePush() {
		pushLoading = true;
		pushError = '';
		pushMsg = '';
		try {
			if (pushToken) {
				await api.unregisterPushToken(pushToken);
			}
			pushEnabled = false;
			pushToken = null;
			safeRemoveStorage('bscan_push_token');
			pushMsg = 'Push notifications disabled.';
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Failed to disable.';
		}
		pushLoading = false;
	}

	async function sendTestPush() {
		pushTestLoading = true;
		pushError = '';
		pushMsg = '';
		try {
			const res = await api.testPush();
			pushMsg = res.message || 'Test notification sent! Check your device.';
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Test failed.';
		}
		pushTestLoading = false;
	}

	async function handleClaimReward() {
		claimLoading = true;
		claimMsg = '';
		try {
			const res = await api.claimReferralReward();
			claimMsg = res.message || 'Reward claimed!';
			referralData = await api.referralStats();
			auth.refresh();
		} catch (err) {
			claimMsg = err instanceof Error ? err.message : 'Failed to claim.';
		}
		claimLoading = false;
	}

	const tabs: Array<{ key: Tab; label: string; icon: string; show?: () => boolean }> = [
		{ key: 'overview', label: 'Overview', icon: '📊' },
		{ key: 'profile', label: 'Profile', icon: '👤' },
		{ key: 'billing', label: 'Billing', icon: '💳' },
		{ key: 'history', label: 'History', icon: '📋' },
		{ key: 'api-keys', label: 'API Keys', icon: '🔑', show: () => isPaid },
		{ key: 'branding', label: 'Branding', icon: '🎨', show: () => isAgency },
		{ key: 'security', label: 'Security', icon: '🔒' },
	];
</script>

<Seo title="Account" description="Sign in to your BSCAN account. View scan history, manage your subscription, edit your profile, and access API keys." />

<div class="account-wrap">

{#if resetToken}
	<!-- ══════ RESET PASSWORD FORM ══════ -->
	<div class="auth-section animate-fade-up">
		<h2>Set a new <span class="text-gold">password</span></h2>
		<p class="text-secondary" style="margin-bottom: 24px;">Enter your new password below.</p>

		{#if resetMsg}
			<div style="padding: 14px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 13px; margin-bottom: 16px; text-align: center;">
				{resetMsg}
				<div style="margin-top: 12px;">
					<a href="/account" class="btn btn-gold">Sign In →</a>
				</div>
			</div>
		{:else}
			<div class="field">
				<label class="label" for="r-pw">New password *</label>
				<input class="input" type="password" id="r-pw" placeholder="Minimum 8 characters" bind:value={resetNewPw} />
			</div>
			<div class="field" style="margin-top: 12px;">
				<label class="label" for="r-pw2">Confirm password *</label>
				<input class="input" type="password" id="r-pw2" placeholder="Repeat password" bind:value={resetConfirm} onkeydown={(e) => e.key === 'Enter' && handleResetPassword()} />
			</div>
			{#if resetError}<div class="msg-error">{resetError}</div>{/if}
			<button class="btn btn-gold" style="width: 100%; margin-top: 16px;" disabled={resetLoading} onclick={handleResetPassword}>
				{#if resetLoading}<span class="spinner spinner-sm"></span>{:else}Reset Password{/if}
			</button>
		{/if}
	</div>

{:else if !$auth.loading && !user}
	<!-- ══════ AUTH FORM ══════ -->
	<div class="auth-section animate-fade-up">
		<h2>{isRegister ? 'Create your' : 'Sign in to your'} <span class="text-gold">account</span></h2>
		<p class="text-secondary" style="margin-bottom: 24px;">
			{isRegister ? 'Start tracking your website health.' : 'Access your dashboard, scan history, and settings.'}
		</p>

		{#if isRegister}
			<div class="field">
				<label class="label" for="a-name">Full name *</label>
				<input class="input" type="text" id="a-name" placeholder="Your name" bind:value={authName} onkeydown={kd} />
			</div>
		{/if}

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-email">Email address *</label>
			<input class="input" type="email" id="a-email" placeholder="you@company.com" autocomplete="email" bind:value={authEmail} onkeydown={kd} />
		</div>

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-pw">Password *</label>
			<input class="input" type="password" id="a-pw" placeholder="Minimum 8 characters" bind:value={authPassword} onkeydown={kd} />
		</div>

		{#if authError}<div class="msg-error">{authError}</div>{/if}

		<button class="btn btn-gold" style="width: 100%; margin-top: 16px;" disabled={authLoading} onclick={handleAuth}>
			{#if authLoading}<span class="spinner spinner-sm"></span>{/if}
			{isRegister ? 'Create Account' : 'Sign In'}
		</button>

		<div class="auth-toggle">
			<span class="text-muted">{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
			<button class="toggle-link" onclick={() => { isRegister = !isRegister; authError = ''; }}>
				{isRegister ? 'Sign in' : 'Create one'}
			</button>
		</div>

		{#if !showForgot}
			<div style="text-align: center; margin-top: 8px;">
				<button class="toggle-link" style="font-size: 12px; color: var(--clr-text-muted);" onclick={() => { showForgot = true; forgotEmail = authEmail; forgotError = ''; forgotMsg = ''; }}>
					Forgot password?
				</button>
			</div>
		{:else}
			<div style="margin-top: 16px; padding: 16px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg);">
				<p style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Reset your password</p>
				<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Enter your email and we'll send you a reset link.</p>
				<input class="input" type="email" placeholder="you@company.com" bind:value={forgotEmail} onkeydown={(e) => e.key === 'Enter' && handleForgotPassword()} />
				{#if forgotError}<div class="msg-error" style="margin-top: 8px;">{forgotError}</div>{/if}
				{#if forgotMsg}<div style="margin-top: 8px; padding: 10px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 12px;">{forgotMsg}</div>{/if}
				<div style="display: flex; gap: 8px; margin-top: 12px;">
					<button class="btn btn-blue" style="flex: 1;" disabled={forgotLoading} onclick={handleForgotPassword}>
						{#if forgotLoading}<span class="spinner spinner-sm"></span>{:else}Send Reset Link{/if}
					</button>
					<button class="btn" style="background: var(--clr-bg-deep); color: var(--clr-text-secondary); border: 1px solid var(--clr-border);" onclick={() => showForgot = false}>Cancel</button>
				</div>
			</div>
		{/if}
	</div>

{:else if $auth.loading}
	<div style="max-width: 600px; margin: var(--space-xl) auto;">
		<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
			<Skeleton variant="circle" width="52px" />
			<div style="flex: 1;">
				<Skeleton variant="bar" width="40%" height="20px" />
				<div style="height: 8px;"></div>
				<Skeleton variant="bar" width="60%" height="14px" />
			</div>
		</div>
		<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
			<Skeleton variant="card" />
			<Skeleton variant="card" />
			<Skeleton variant="card" />
		</div>
		<Skeleton lines={5} />
	</div>

{:else if user}
	<!-- ══════ DASHBOARD — SIDEBAR LAYOUT ══════ -->
	<div class="dash-layout animate-fade-up">

		<!-- ── LEFT SIDEBAR ──────────────────────── -->
		<aside class="sidebar">
			<!-- Avatar / Upload -->
			<div class="sidebar-avatar-wrap">
				<div class="sidebar-avatar" role="button" tabindex="0" aria-label="Change avatar" onclick={() => document.getElementById('avatar-upload')?.click()}>
					{#if avatarUrl || user.avatar_url}
						<img src={avatarUrl || user.avatar_url} alt="Avatar" class="avatar-img" />
					{:else}
						<span class="avatar-letter">{(user.name || user.email)[0].toUpperCase()}</span>
					{/if}
					<div class="avatar-overlay">📷</div>
				</div>
				<input type="file" id="avatar-upload" accept="image/png,image/jpeg,image/webp" style="display: none;" onchange={async (e) => {
					const file = (e.target as HTMLInputElement).files?.[0];
					if (!file) return;
					if (file.size > 2 * 1024 * 1024) {
						profileMsg = 'Image must be under 2MB';
						return;
					}
					try {
						const res = await api.uploadAvatar(file);
						avatarUrl = res.avatar_url;
						profileMsg = 'Avatar uploaded!';
						auth.refresh();
					} catch (err) {
						profileMsg = err instanceof Error ? err.message : 'Upload failed';
					}
				}} />
				<div class="sidebar-name">{user.name || 'User'}</div>
				<div class="sidebar-email text-muted">{user.email}</div>
				<span class="plan-badge {plan}" style="margin-top: 6px;">{planLabel}</span>
			</div>

			<!-- Navigation -->
			<nav class="sidebar-nav">
				{#each tabs as tab}
					{#if !tab.show || tab.show()}
						{#if tab.key === 'security'}
							<!-- Security goes in settings section below -->
						{:else}
							<button
								class="sidebar-item"
								class:active={activeTab === tab.key}
								onclick={() => activeTab = tab.key}
							>
								<span class="sidebar-icon">{tab.icon}</span>
								<span class="sidebar-label">{tab.label}</span>
							</button>
						{/if}
					{/if}
				{/each}
			</nav>

			<!-- Settings (bottom) -->
			<div class="sidebar-footer">
				<button class="sidebar-item" class:active={activeTab === 'security'} onclick={() => activeTab = 'security'}>
					<span class="sidebar-icon">⚙️</span>
					<span class="sidebar-label">Settings</span>
				</button>
				<button class="sidebar-item signout" onclick={() => auth.logout()}>
					<span class="sidebar-icon">🚪</span>
					<span class="sidebar-label">Sign Out</span>
				</button>
			</div>
		</aside>

		<!-- ── MAIN CONTENT ──────────────────────── -->
		<main class="dash-main">

		<!-- ── OVERVIEW TAB ─────────────────────── -->
		{#if activeTab === 'overview'}
			<div class="tab-content animate-fade-up">
				<h2 class="dash-title">Dashboard</h2>

				<!-- Stats Row -->
				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-label">Plan</div>
						<div class="stat-value"><span class="plan-badge {plan}">{planLabel}</span></div>
						{#if !isPaid}
							<button class="btn btn-gold btn-sm" style="margin-top: 8px;" onclick={() => activeTab = 'billing'}>Upgrade →</button>
						{/if}
					</div>
					<div class="stat-card">
						<div class="stat-label">Scans this month</div>
						<div class="stat-value">{user.scans_this_month}</div>
						<div class="stat-sub text-muted">
							{#if plan === 'free' || plan === 'guest'}of 3 free{:else if plan === 'pro'}of 30{:else}unlimited{/if}
						</div>
					</div>
					<div class="stat-card">
						<div class="stat-label">Member since</div>
						<div class="stat-value" style="font-size: 16px;">{formatDate(user.created_at)}</div>
					</div>
				</div>

				<!-- Big Action Cards (2x2) -->
				<div class="action-grid">
					<a href="/" class="big-action-card action-scan">
						<div class="big-action-icon">🔍</div>
						<div class="big-action-text">
							<h3>New Scan</h3>
							<p>Get a complete website audit — scores, issues, and fixes.</p>
						</div>
					</a>
					<a href="/compare" class="big-action-card action-compare">
						<div class="big-action-icon">📊</div>
						<div class="big-action-text">
							<h3>Compare</h3>
							<p>See how two sites stack up across all categories.</p>
						</div>
					</a>
					<a href="/seo" class="big-action-card action-seo">
						<div class="big-action-icon">🎯</div>
						<div class="big-action-text">
							<h3>SEO Tools</h3>
							<p>Keywords, backlinks, Search Console, and more.</p>
						</div>
					</a>
					<a href="/team" class="big-action-card action-team">
						<div class="big-action-icon">👥</div>
						<div class="big-action-text">
							<h3>Team</h3>
							<p>Manage your team and share scan access.</p>
						</div>
					</a>
				</div>

				<!-- Recent Scans Table -->
				<!-- Referral Card -->
				{#if referralData && !referralLoading}
					<div class="referral-card">
						<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
							<span style="font-size: 22px;">🎁</span>
							<div>
								<h3 style="margin: 0; font-size: 14px;">Invite Friends, Get Pro Free</h3>
								<p class="text-muted" style="font-size: 11px; margin: 2px 0 0;">Refer 3 verified users to earn 1 month Pro</p>
							</div>
						</div>
						<div style="background: var(--clr-bg-deep); border-radius: 6px; height: 6px; margin-bottom: 10px; overflow: hidden;">
							<div style="height: 100%; background: linear-gradient(90deg, var(--clr-gold), #f59e0b); border-radius: 6px; width: {Math.min(100, (referralData.verified / referralData.goal) * 100)}%;"></div>
						</div>
						<div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--clr-text-muted); margin-bottom: 12px;">
							<span>{referralData.verified}/{referralData.goal} verified</span>
							{#if referralData.pending > 0}<span>{referralData.pending} pending</span>{/if}
						</div>
						<div style="display: flex; gap: 8px;">
							<input type="text" readonly value={referralData.referral_url} class="input" style="flex: 1; font-size: 10px; font-family: var(--font-mono); background: var(--clr-bg-deep); padding: 8px 10px;" />
							<button class="btn btn-gold btn-sm" onclick={() => navigator.clipboard.writeText(referralData.referral_url)}>Copy</button>
						</div>
						{#if referralData.reward_available}
							<button class="btn btn-sm" style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, var(--clr-gold), #f59e0b); color: var(--clr-bg-deep); border: none; font-weight: 700;" disabled={claimLoading} onclick={handleClaimReward}>
								{#if claimLoading}Claiming...{:else}Claim 1 Month Pro{/if}
							</button>
						{:else if referralData.reward_claimed}
							<div style="text-align: center; font-size: 11px; color: var(--clr-success); font-weight: 600; margin-top: 10px;">Reward claimed!</div>
						{/if}
						{#if claimMsg}<div style="text-align: center; font-size: 11px; color: var(--clr-success); margin-top: 6px;">{claimMsg}</div>{/if}
					</div>
				{/if}

				{#if historyItems.length > 0}
					<div class="card" style="margin-top: 20px;">
						<div class="card-header">
							<span>📋</span>
							<span style="font-weight: 700; font-size: 14px;">Recent Scans</span>
							<button class="btn btn-ghost btn-sm" style="margin-left: auto;" onclick={() => activeTab = 'history'}>View All →</button>
						</div>
						<div class="card-body" style="padding: 0;">
							<!-- Table Header -->
							<div class="scan-table-header">
								<span class="th-website">Website</span>
								<span class="th-score">Score</span>
								<span class="th-date">Date</span>
								<span class="th-trend"></span>
							</div>
							{#each historyItems.slice(0, 5) as s}
								<div class="scan-table-row">
									<div class="st-website">
										<img class="favicon" src={safeFaviconUrl(getDomain(s.url))} alt="" />
										<span class="font-mono">{s.url?.replace('https://', '').replace('http://', '').split('/')[0] || '—'}</span>
									</div>
									<div class="st-score font-mono" style="color: {scoreColor(s.overall_score || 0)};">
										{s.overall_score || '—'}
										<svg class="trend-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
											<polyline points="17 6 23 6 23 12"></polyline>
										</svg>
									</div>
									<div class="st-date text-muted">{s.created_at ? formatDate(s.created_at) : ''}</div>
									<div class="st-trend">
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--clr-text-muted)" stroke-width="2" style="opacity: 0.4;">
											<polyline points="7 17 12 12 17 17"></polyline>
											<polyline points="7 7 12 12 17 7"></polyline>
										</svg>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ── PROFILE TAB ──────────────────────── -->
		{#if activeTab === 'profile'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">My Profile</h3>

				<!-- Name & Identity -->
				<div class="card" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>👤</span>
						<span style="font-weight: 700; font-size: 14px;">Name & Identity</span>
					</div>
					<div class="card-body">
						<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
							<div>
								<div class="text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-family: var(--font-mono);">Account Name</div>
								<div style="font-size: 20px; font-weight: 700;">{user.name || '—'}</div>
								<div class="text-muted" style="font-size: 12px;">{user.email}</div>
							</div>
							<button class="btn btn-outline btn-sm" style="margin-left: auto;" onclick={() => showNameChange = !showNameChange}>
								{showNameChange ? 'Cancel' : 'Request Name Change'}
							</button>
						</div>
						{#if showNameChange}
							<div style="margin-top: 12px; padding: 12px; background: var(--clr-bg-deep); border-radius: var(--radius-md); border: 1px solid var(--clr-border);">
								<label class="label" style="margin-bottom: 6px;">New Name</label>
								<div style="display: flex; gap: 8px;">
									<input class="input" type="text" placeholder="Your requested name" bind:value={nameChangeInput} style="flex: 1;" />
									<button class="btn btn-gold btn-sm" disabled={nameChangeSending} onclick={requestNameChange}>
										{#if nameChangeSending}<span class="spinner spinner-sm"></span>{/if} Submit
									</button>
								</div>
								<p class="text-muted" style="font-size: 11px; margin-top: 6px;">Name changes require admin approval and are usually reviewed within 24 hours.</p>
							</div>
						{/if}
						{#if nameChangeMsg}<div class="msg-success" style="margin-top: 8px;">{nameChangeMsg}</div>{/if}

						<div class="form-grid" style="margin-top: 16px;">
							<div class="field">
								<label class="label" for="p-username">Username</label>
								<input class="input" type="text" id="p-username" placeholder="e.g. chisom_bw" bind:value={profileData.username} oninput={handleUsernameCheck} />
								{#if usernameCheck}
									<span class="field-hint" class:hint-ok={usernameCheck.startsWith('✓')} class:hint-err={usernameCheck.startsWith('✗')}>{usernameCheck}</span>
								{/if}
							</div>
							<div class="field">
								<label class="label" for="p-display">Display Name <span style="color:var(--clr-danger);">*</span></label>
								<input class="input" type="text" id="p-display" placeholder="How you appear to others" bind:value={profileData.display_name} />
							</div>
						</div>
					</div>
				</div>

				<!-- Contact & Company -->
				<div class="card" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>💼</span>
						<span style="font-weight: 700; font-size: 14px;">Contact & Company</span>
					</div>
					<div class="card-body">
						<div class="form-grid">
							<div class="field">
								<label class="label" for="p-company">Company <span style="color:var(--clr-danger);">*</span></label>
								<input class="input" type="text" id="p-company" placeholder="e.g. Balancewise Technologies" bind:value={profileData.company} />
							</div>
							<div class="field">
								<label class="label" for="p-website">Website</label>
								<input class="input" type="url" id="p-website" placeholder="https://yoursite.com" bind:value={profileData.website} />
							</div>
							<div class="field">
								<label class="label" for="p-phone">Phone <span style="color:var(--clr-danger);">*</span></label>
								<input class="input" type="tel" id="p-phone" placeholder="+44..." bind:value={profileData.phone} />
							</div>
						</div>
					</div>
				</div>

				<!-- Address -->
				<div class="card" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>📍</span>
						<span style="font-weight: 700; font-size: 14px;">Address</span>
					</div>
					<div class="card-body">
						<div class="form-grid">
							<div class="field">
								<label class="label" for="p-postcode">Postcode <span style="color:var(--clr-danger);">*</span></label>
								<div style="display: flex; gap: 8px;">
									<input class="input" type="text" id="p-postcode" placeholder="e.g. NE1 8ST" bind:value={profileData.postcode} style="flex: 1;" />
									<button class="btn btn-outline btn-sm" onclick={lookupPostcode} title="Auto-detect city from postcode">📍 Detect</button>
								</div>
							</div>
							<div class="field">
								<label class="label" for="p-addr1">Address Line 1 <span style="color:var(--clr-danger);">*</span></label>
								<input class="input" type="text" id="p-addr1" placeholder="e.g. 12 Oak Street" bind:value={profileData.address_line1} />
							</div>
							<div class="field">
								<label class="label" for="p-addr2">Address Line 2 <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
								<input class="input" type="text" id="p-addr2" placeholder="Flat, building, etc." bind:value={profileData.address_line2} />
							</div>
							<div class="field">
								<label class="label" for="p-city">City <span style="color:var(--clr-danger);">*</span></label>
								<input class="input" type="text" id="p-city" bind:value={profileData.city} />
							</div>
							<div class="field">
								<label class="label" for="p-country">Country <span style="color:var(--clr-danger);">*</span></label>
								<input class="input" type="text" id="p-country" bind:value={profileData.country} />
							</div>
						</div>
					</div>
				</div>

				<!-- Bio -->
				<div class="card" style="margin-bottom: 16px;">
					<div class="card-header">
						<span>📝</span>
						<span style="font-weight: 700; font-size: 14px;">About</span>
					</div>
					<div class="card-body">
						<div class="field">
							<label class="label" for="p-bio">Bio</label>
							<textarea class="input" id="p-bio" rows="3" placeholder="Tell us about yourself..." bind:value={profileData.bio} style="resize: vertical;"></textarea>
						</div>
					</div>
				</div>

				{#if profileMsg}
					<div style="margin-top: 4px; margin-bottom: 8px; padding: 10px 14px; border-radius: 8px; font-size: 13px; background: {profileMsg.startsWith('Required:') || profileMsg.startsWith('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color: {profileMsg.startsWith('Required:') || profileMsg.startsWith('Failed') ? 'var(--clr-danger)' : 'var(--clr-success)'};">
						{profileMsg}
					</div>
				{/if}

				<button class="btn btn-gold" disabled={profileSaving} onclick={saveProfile}>
					{#if profileSaving}<span class="spinner spinner-sm"></span>{/if} Save Profile
				</button>
			</div>
		{/if}

		<!-- ── BILLING TAB ──────────────────────── -->
		{#if activeTab === 'billing'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Billing & Plan</h3>

				<!-- Current Plan -->
				<div class="card" style="margin-bottom: 20px;">
					<div class="card-body">
						<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
							<div>
								<div class="text-muted" style="font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px;">Current Plan</div>
								<div style="font-size: 28px; font-weight: 800;">{planLabel}</div>
							</div>
							<div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap;">
								{#if !isPaid}
									<button class="btn btn-gold" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro — £9/mo</button>
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Go Agency — £29/mo</button>
								{:else if plan === 'pro'}
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency</button>
									<button class="btn btn-outline" disabled={portalLoading} onclick={openBillingPortal}>
										{#if portalLoading}<span class="spinner spinner-sm"></span>{/if} Manage Subscription
									</button>
								{:else}
									<!-- Agency — highest plan -->
									<button class="btn btn-outline" disabled={portalLoading} onclick={openBillingPortal}>
										{#if portalLoading}<span class="spinner spinner-sm"></span>{/if} Manage Subscription
									</button>
								{/if}
							</div>
						</div>
						{#if billingError}
							<div class="msg-error" style="margin-top: 12px;">{billingError}</div>
						{/if}
						{#if isPaid}
							<div style="margin-top: 12px; font-size: 12px; color: var(--clr-text-muted);">
								To downgrade or cancel, click Manage Subscription above. If unavailable, email <a href="mailto:support@balancewises.io" style="color: var(--clr-blue);">support@balancewises.io</a>.
							</div>
						{/if}
					</div>
				</div>

				<!-- Plan Comparison — visible to all -->
				<div class="plan-compare">
					<div class="compare-col" class:active-plan={!isPaid}>
						<div class="compare-header free">Free</div>
						<div class="compare-feat">3 scans/month</div>
						<div class="compare-feat">Basic audit</div>
						<div class="compare-feat dim">No PDF export</div>
						<div class="compare-feat dim">No scan history</div>
						<div class="compare-feat dim">No compare tool</div>
						{#if isPaid}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-text-muted);">Current features exceed this plan</div>
						{/if}
					</div>
					<div class="compare-col" class:featured={!isPaid || plan === 'pro'} class:active-plan={plan === 'pro'}>
						<div class="compare-header pro">Pro · £9/mo</div>
						<div class="compare-feat">30 scans/month</div>
						<div class="compare-feat">Core Web Vitals</div>
						<div class="compare-feat">PDF reports</div>
						<div class="compare-feat">Scan history</div>
						<div class="compare-feat">Compare tool</div>
						<div class="compare-feat">SEO tools</div>
						{#if !isPaid}
							<button class="btn btn-gold btn-sm" style="margin-top: 12px;" onclick={() => ui.openCheckout('pro')}>Upgrade</button>
						{:else if plan === 'pro'}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-gold); font-weight: 700;">✓ Your current plan</div>
						{/if}
					</div>
					<div class="compare-col" class:featured={plan === 'agency'} class:active-plan={plan === 'agency'}>
						<div class="compare-header agency">Agency · £29/mo</div>
						<div class="compare-feat">Unlimited scans</div>
						<div class="compare-feat">5 team members</div>
						<div class="compare-feat">API access</div>
						<div class="compare-feat">White-label PDFs</div>
						<div class="compare-feat">AI SEO strategy</div>
						<div class="compare-feat">Priority support</div>
						{#if plan !== 'agency'}
							<button class="btn btn-blue btn-sm" style="margin-top: 12px;" onclick={() => ui.openCheckout('agency')}>Upgrade</button>
						{:else}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-blue); font-weight: 700;">✓ Your current plan</div>
						{/if}
					</div>
				</div>

				<!-- Promo Code -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>🎁</span>
						<span style="font-weight: 700; font-size: 14px;">Promo Code</span>
					</div>
					<div class="card-body">
						<div style="display: flex; gap: 8px;">
							<input class="input" type="text" placeholder="Enter code..." bind:value={promoCode} style="flex: 1; text-transform: uppercase;" onkeydown={(e) => e.key === 'Enter' && redeemPromo()} />
							<button class="btn btn-gold" disabled={promoLoading} onclick={redeemPromo}>
								{#if promoLoading}<span class="spinner spinner-sm"></span>{:else}Redeem{/if}
							</button>
						</div>
						{#if promoMsg}<div class="msg-success">{promoMsg}</div>{/if}
						{#if promoError}<div class="msg-error">{promoError}</div>{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── HISTORY TAB ──────────────────────── -->
		{#if activeTab === 'history'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Scan History</h3>

				{#if !isPaid}
					<div class="upgrade-banner">
						<span>🔒</span>
						<span>Scan history is a Pro feature. <button class="toggle-link" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro →</button></span>
					</div>
				{/if}

				{#if historyLoading && historyItems.length === 0}
					<div class="card"><div class="card-body" style="padding: 0;">
						{#each Array(5) as _}
							<div style="display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--clr-border);">
								<Skeleton variant="circle" width="16px" />
								<div style="flex: 1;"><Skeleton variant="bar" width="70%" height="13px" /></div>
								<Skeleton variant="bar" width="32px" height="18px" />
								<Skeleton variant="bar" width="60px" height="11px" />
							</div>
						{/each}
					</div></div>
				{:else if historyItems.length === 0}
					<div class="empty-state">
						<p class="text-muted">No scans yet. <a href="/">Run your first scan →</a></p>
					</div>
				{:else}
					<div class="card">
						<div class="card-body" style="padding: 0;">
							{#each historyItems as s}
								<div class="history-row">
									<img class="favicon" src={safeFaviconUrl(getDomain(s.url))} alt="" />
									<div class="history-url font-mono">{s.url?.replace('https://', '').replace('http://', '').split('/')[0] || '—'}</div>
									<div class="history-score font-mono" style="color: {scoreColor(s.overall_score || 0)};">{s.overall_score}</div>
									<div class="history-date text-muted">{s.created_at ? formatDate(s.created_at) : ''}</div>
									{#if s.id}
										{#if isPaid}
											<button class="btn btn-ghost btn-sm" onclick={async () => {
												try { await api.downloadPdf(s.id, `bscan-${getDomain(s.url)}.pdf`); } catch {}
											}}>📄 PDF</button>
										{:else}
											<button class="btn btn-ghost btn-sm" onclick={() => ui.showPaywall('PDF Export', 'Download professional audit reports. Upgrade to Pro to unlock.')}>🔒 PDF</button>
										{/if}
									{/if}
								</div>
							{/each}
						</div>
					</div>
					{#if historyHasMore}
						<div style="text-align: center; margin-top: 16px;">
							<button class="btn btn-outline" disabled={historyLoading} onclick={loadMoreHistory}>
								{#if historyLoading}<span class="spinner spinner-sm"></span>{/if} Load More
							</button>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- ── API KEYS TAB ─────────────────────── -->
		{#if activeTab === 'api-keys'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">API Keys</h3>

				<div class="card" style="margin-bottom: 20px;">
					<div class="card-header">
						<span>➕</span>
						<span style="font-weight: 700; font-size: 14px;">Create New Key</span>
					</div>
					<div class="card-body">
						<div style="display: flex; gap: 8px;">
							<input class="input" type="text" placeholder="Key name (e.g. Production)" bind:value={newKeyName} onkeydown={(e) => e.key === 'Enter' && createKey()} style="flex: 1;" />
							<button class="btn btn-gold" onclick={createKey}>Create</button>
						</div>
						{#if newKeyResult}
							<div class="key-reveal">
								<div class="text-muted" style="font-size: 11px; margin-bottom: 4px;">Your new API key (copy it now — it won't be shown again):</div>
								<code class="key-code">{newKeyResult}</code>
								<button class="btn btn-outline btn-sm" style="margin-top: 8px;" onclick={() => { navigator.clipboard.writeText(newKeyResult || ''); }}>Copy</button>
							</div>
						{/if}
					</div>
				</div>

				<div class="card">
					<div class="card-header">
						<span>🔑</span>
						<span style="font-weight: 700; font-size: 14px;">Active Keys</span>
					</div>
					<div class="card-body" style="padding: 0;">
						{#if apiKeys.length === 0}
							<div class="empty-state"><p class="text-muted">No API keys yet.</p></div>
						{:else}
							{#each apiKeys as key}
								<div class="key-row">
									<div>
										<div style="font-weight: 600; font-size: 13px;">{key.name || 'Unnamed'}</div>
										<div class="text-muted font-mono" style="font-size: 11px;">{key.prefix || key.id}...</div>
									</div>
									<button class="btn btn-ghost btn-sm" style="color: var(--clr-danger);" onclick={() => revokeKey(key.id)}>Revoke</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── SECURITY TAB ─────────────────────── -->
		{#if activeTab === 'branding'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">White-Label Branding</h3>
				{#if !isAgency}
					<div class="card">
						<div class="card-body" style="text-align: center; padding: 40px;">
							<div style="font-size: 48px; margin-bottom: 12px;">🎨</div>
							<h3 style="margin-bottom: 8px;">Agency Feature</h3>
							<p class="text-muted" style="max-width: 400px; margin: 0 auto 16px;">White-label your PDF reports with your own brand name, colours, and logo. Clients see your brand, not BSCAN.</p>
							<button class="btn btn-gold" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency →</button>
						</div>
					</div>
				{:else}
					<div class="card" style="margin-bottom: 20px;">
						<div class="card-header">
							<span>🏷️</span>
							<span style="font-weight: 700;">Brand Settings</span>
							<span class="plan-badge agency" style="margin-left: auto;">Agency</span>
						</div>
						<div class="card-body">
							<p class="text-muted" style="font-size: 12px; margin-bottom: 16px;">These settings apply to all PDF reports you download. Your clients will see your brand instead of BSCAN.</p>
							<div class="form-grid">
								<div class="field">
									<label class="label" for="b-name">Brand Name</label>
									<input class="input" type="text" id="b-name" placeholder="Your Agency Name" bind:value={brandName} />
								</div>
								<div class="field">
									<label class="label" for="b-color">Brand Colour</label>
									<div style="display: flex; gap: 8px; align-items: center;">
										<input type="color" id="b-color" bind:value={brandColor} style="width: 44px; height: 36px; border: none; background: none; cursor: pointer;" />
										<input class="input" type="text" placeholder="#f0a500" bind:value={brandColor} style="flex: 1; font-family: var(--font-mono);" />
									</div>
								</div>
								<div class="field" style="grid-column: 1 / -1;">
									<label class="label" for="b-logo">Logo URL</label>
									<input class="input" type="url" id="b-logo" placeholder="https://yoursite.com/logo.png" bind:value={brandLogoUrl} />
									<span class="field-hint" style="color: var(--clr-text-muted);">PNG or SVG recommended. Appears on your white-label PDF reports.</span>
								</div>
							</div>
							{#if brandMsg}<div class="msg-success" style="margin-top: 12px;">{brandMsg}</div>{/if}
							<button class="btn btn-gold" style="margin-top: 16px;" disabled={brandSaving} onclick={saveBranding}>
								{#if brandSaving}<span class="spinner spinner-sm"></span>{/if} Save Branding
							</button>
						</div>
					</div>

					<div class="card">
						<div class="card-header">
							<span>👁️</span>
							<span style="font-weight: 700;">Preview</span>
						</div>
						<div class="card-body">
							<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">This is how your PDF report footer will look:</p>
							<div style="background: var(--clr-bg-deep); border-radius: 8px; padding: 20px; text-align: center; border: 1px solid var(--clr-border);">
								<div style="font-size: 14px; font-weight: 700; color: {brandColor || '#f0a500'};">{brandName || 'Your Brand Name'}</div>
								<div style="font-size: 11px; color: var(--clr-text-muted); margin-top: 4px;">Generated by {brandName || 'Your Brand Name'}</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ── SECURITY TAB ─────────────────────── -->
		{#if activeTab === 'security'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">Security & Notifications</h3>

				<!-- Push Notifications -->
				<div class="card" style="margin-bottom: 20px;">
					<div class="card-header">
						<span>🔔</span>
						<span style="font-weight: 700; font-size: 14px;">Push Notifications</span>
					</div>
					<div class="card-body">
						{#if !pushSupported}
							<p class="text-muted" style="font-size: 13px;">Push notifications are not supported in this browser. Try Chrome, Edge, or Firefox on desktop.</p>
						{:else}
							<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
								<div>
									<p style="font-size: 13px; font-weight: 600; margin-bottom: 2px;">
										{pushEnabled ? '✓ Enabled' : 'Disabled'}
									</p>
									<p class="text-muted" style="font-size: 12px;">
										Get notified when your monitored sites drop in score.
									</p>
								</div>
								<button
									class="push-toggle"
									class:active={pushEnabled}
									disabled={pushLoading}
									onclick={togglePush}
									aria-label={pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
								>
									<span class="push-toggle-knob"></span>
								</button>
							</div>

							{#if pushPermission === 'denied'}
								<div class="msg-warning" style="font-size: 12px;">
									Notifications are blocked by your browser. To fix: click the lock icon in your address bar → Site settings → Allow notifications.
								</div>
							{/if}

							{#if pushError}<div class="msg-error">{pushError}</div>{/if}
							{#if pushMsg}<div class="msg-success">{pushMsg}</div>{/if}

							{#if pushEnabled}
								<button class="btn btn-outline btn-sm" style="margin-top: 10px;" disabled={pushTestLoading} onclick={sendTestPush}>
									{#if pushTestLoading}<span class="spinner spinner-sm"></span>{:else}🔔 Send Test Notification{/if}
								</button>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Change Password -->
				<div class="card">
					<div class="card-header">
						<span>🔒</span>
						<span style="font-weight: 700; font-size: 14px;">Change Password</span>
					</div>
					<div class="card-body">
						<div class="field">
							<label class="label" for="s-current">Current Password</label>
							<input class="input" type="password" id="s-current" bind:value={pwCurrent} />
						</div>
						<div class="field" style="margin-top: 12px;">
							<label class="label" for="s-new">New Password</label>
							<input class="input" type="password" id="s-new" placeholder="Minimum 8 characters" bind:value={pwNew} />
						</div>
						<div class="field" style="margin-top: 12px;">
							<label class="label" for="s-confirm">Confirm New Password</label>
							<input class="input" type="password" id="s-confirm" bind:value={pwConfirm} />
						</div>
						{#if pwError}<div class="msg-error">{pwError}</div>{/if}
						{#if pwSuccess}<div class="msg-success">{pwSuccess}</div>{/if}
						<button class="btn btn-gold" style="margin-top: 16px;" onclick={changePassword}>Update Password</button>
					</div>
				</div>

				<!-- Active Sessions Info -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>🛡️</span>
						<span style="font-weight: 700; font-size: 14px;">Session</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Your login session is valid for 30 days. Sign out on all devices by changing your password.</p>
						<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3);" onclick={() => { auth.logout(); window.location.href = '/account'; }}>Sign Out</button>
					</div>
				</div>
			</div>
		{/if}

		</main>

		<!-- ── EMAIL VERIFICATION BANNER ──────────── -->
		{#if user && user.email_verified === false}
			<div class="verify-banner">
				<div class="verify-banner-inner">
					<span style="font-size: 20px;">📧</span>
					<div style="flex: 1;">
						<strong>Verify your email</strong>
						<p class="text-muted" style="font-size: 12px; margin-top: 2px;">Check your inbox for a verification link. Some features are limited until you verify.</p>
					</div>
					<button class="btn btn-sm" style="background: var(--clr-success); color: white; border: none; flex-shrink: 0;" disabled={resendLoading} onclick={handleResendVerification}>
						{#if resendLoading}Sending...{:else}Resend Email{/if}
					</button>
				</div>
				{#if verifyMsg}<div style="padding: 8px 16px; font-size: 12px; color: var(--clr-success);">{verifyMsg}</div>{/if}
				{#if verifyError}<div style="padding: 8px 16px; font-size: 12px; color: var(--clr-danger);">{verifyError}</div>{/if}
			</div>
		{/if}

		<!-- ── RIGHT PANEL ───────────────────────── -->
		<aside class="right-panel">
			<div class="rp-section">
				<div class="rp-title">💬 Team Space</div>
				{#if isAgency}
					<p class="rp-desc">Share ideas and discuss with your team members.</p>
					<div class="team-avatars">
						<div class="team-avatar-sm">👤</div>
						<div class="team-avatar-sm">👤</div>
						<div class="team-avatar-sm">👤</div>
						<div class="team-avatar-sm plus">+</div>
					</div>
					<a href="/team" class="btn btn-outline btn-sm" style="width: 100%; text-align: center; margin-top: 10px;">Open Team →</a>
				{:else}
					<p class="rp-desc">Upgrade to Agency to unlock team collaboration, shared notes, and group discussions.</p>
					<button class="btn btn-blue btn-sm" style="width: 100%;" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency</button>
				{/if}
			</div>

			<div class="rp-section">
				<div class="rp-title">📊 Quick Stats</div>
				<div class="rp-stat">
					<span class="text-muted">Scans</span>
					<div style="display: flex; align-items: center; gap: 6px;">
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--clr-success)" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
						<span style="font-weight: 700;">{user.scans_this_month}</span>
					</div>
				</div>
				<div class="rp-stat">
					<span class="text-muted">Plan</span>
					<span class="plan-badge {plan}" style="font-size: 10px;">{planLabel}</span>
				</div>
				<div class="rp-stat">
					<span class="text-muted">Joined</span>
					<span style="font-size: 12px;">{formatDate(user.created_at)}</span>
				</div>
			</div>

			<div class="rp-section">
				<div class="rp-title">🔗 Quick Links</div>
				<a href="/" class="rp-link-card">
					<span>🔍 New Scan</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/compare" class="rp-link-card">
					<span>📊 Compare</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/seo" class="rp-link-card">
					<span>🎯 SEO Tools</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/leaderboard" class="rp-link-card">
					<span>🏆 Leaderboard</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/api-docs" class="rp-link-card">
					<span>🔌 API Docs</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
			</div>
		</aside>

	</div>
{/if}

</div>

<style>
	/* ── Account Wrapper (full width) ──── */
	.account-wrap { width: 100%; max-width: 100%; padding: 0 var(--space-md); }

	/* ── Auth ──────────────────────────────── */
	.container-account { width: 100%; max-width: 100%; padding: 0 var(--space-lg); }

	.auth-section { max-width: 400px; margin: var(--space-xl) auto; text-align: center; }
	.field { text-align: left; }
	.auth-toggle { margin-top: 16px; font-size: 13px; text-align: center; }
	.toggle-link { background: none; border: none; color: var(--clr-gold); cursor: pointer; font-family: inherit; font-weight: 600; font-size: 13px; margin-left: 4px; }
	.loading-state { text-align: center; padding: var(--space-2xl); }

	.msg-error { margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-danger-dim); color: var(--clr-danger); font-size: 12px; border: 1px solid rgba(239,68,68,0.2); }
	.msg-success { margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--clr-success-dim); color: var(--clr-success); font-size: 12px; }
	.msg-warning { padding: 10px 14px; border-radius: var(--radius-sm); background: rgba(245,158,11,0.08); color: var(--clr-warning); font-size: 12px; border: 1px solid rgba(245,158,11,0.2); }

	/* Push notification toggle */
	.push-toggle { position: relative; width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; background: var(--clr-bg-deep); border: 1px solid var(--clr-border); transition: all 0.2s; flex-shrink: 0; }
	.push-toggle.active { background: var(--clr-success); border-color: var(--clr-success); }
	.push-toggle:disabled { opacity: 0.5; cursor: wait; }
	.push-toggle-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
	.push-toggle.active .push-toggle-knob { transform: translateX(20px); }

	/* ── Dashboard Layout (3-column) ─────── */
	.dash-layout { display: grid; grid-template-columns: 180px 1fr 210px; gap: 0; min-height: calc(100vh - 70px); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); overflow: hidden; width: 100%; max-width: 1800px; margin: 0 auto; position: relative; left: 50%; transform: translateX(-50%); }

	/* ── Left Sidebar ─────────────────────── */
	.sidebar { background: var(--clr-bg-card); border-right: 1px solid var(--clr-border); display: flex; flex-direction: column; padding: var(--space-md) 0; }

	.sidebar-avatar-wrap { display: flex; flex-direction: column; align-items: center; padding: var(--space-md); padding-bottom: var(--space-lg); border-bottom: 1px solid var(--clr-border); margin-bottom: var(--space-sm); }
	.sidebar-avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--clr-gold-dim); border: 3px solid rgba(240,165,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; transition: all var(--duration-fast); }
	.sidebar-avatar:hover { border-color: var(--clr-gold); }
	.sidebar-avatar:hover .avatar-overlay { opacity: 1; }
	.avatar-letter { font-size: 24px; font-weight: 800; color: var(--clr-gold); }
	.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
	.avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 20px; opacity: 0; transition: opacity var(--duration-fast); border-radius: 50%; }
	.sidebar-name { font-size: 14px; font-weight: 700; margin-top: 10px; text-align: center; }
	.sidebar-email { font-size: 11px; text-align: center; overflow: hidden; text-overflow: ellipsis; max-width: 100%; white-space: nowrap; }

	.sidebar-nav { flex: 1; padding: var(--space-xs) 0; }
	.sidebar-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 16px; border: none; background: transparent; color: var(--clr-text-muted); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: all var(--duration-fast); text-align: left; }
	.sidebar-item:hover { color: var(--clr-text-primary); background: rgba(255,255,255,0.04); }
	.sidebar-item.active { color: var(--clr-text-primary); background: rgba(59,130,246,0.1); border-left: 3px solid var(--clr-blue); padding-left: 13px; }
	.sidebar-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; }
	.sidebar-label { white-space: nowrap; }

	.sidebar-footer { border-top: 1px solid var(--clr-border); padding-top: var(--space-sm); margin-top: auto; }
	.sidebar-item.signout { color: var(--clr-danger); }
	.sidebar-item.signout:hover { background: rgba(239,68,68,0.08); }

	/* ── Main Content ─────────────────────── */
	.dash-main { padding: 24px 28px; overflow-y: auto; min-width: 0; }
	.tab-content { min-height: 200px; }

	/* ── Right Panel ──────────────────────── */
	.right-panel { background: var(--clr-bg-card); border-left: 1px solid var(--clr-border); padding: var(--space-md); overflow-y: auto; }
	.rp-section { margin-bottom: var(--space-lg); }
	.rp-title { font-size: 12px; font-weight: 700; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-family: var(--font-mono); }
	.rp-desc { font-size: 12px; color: var(--clr-text-muted); line-height: 1.5; margin-bottom: 10px; }
	.rp-stat { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; border-bottom: 1px solid var(--clr-border); }
	.rp-stat:last-child { border-bottom: none; }
	.rp-link { display: block; padding: 7px 0; font-size: 12px; color: var(--clr-text-secondary); text-decoration: none; transition: color var(--duration-fast); }
	.rp-link:hover { color: var(--clr-gold); }

	/* ── Plan Badge ────────────────────────── */
	.plan-badge { display: inline-block; padding: 3px 12px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; }
	.plan-badge.free, .plan-badge.guest { background: var(--clr-border); color: var(--clr-text-secondary); }
	.plan-badge.pro { background: var(--clr-gold-dim); color: var(--clr-gold); }
	.plan-badge.agency { background: var(--clr-blue-dim); color: var(--clr-blue); }

	/* ── Dashboard Title ───────────────────── */
	.dash-title { font-size: 22px; font-weight: 700; margin-bottom: var(--space-md); }

	/* ── Stats ─────────────────────────────── */
	.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: var(--space-md); }
	.stat-card { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 14px; }
	.stat-label { font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
	.stat-value { font-size: 20px; font-weight: 700; }
	.stat-sub { font-size: 11px; margin-top: 2px; }

	/* ── Big Action Cards (2x2 grid) ──────── */
	.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: var(--space-md); }
	.big-action-card { display: flex; align-items: center; gap: 14px; padding: 20px; border-radius: var(--radius-lg); text-decoration: none; color: white; transition: all var(--duration-fast); border: 1px solid transparent; position: relative; overflow: hidden; min-height: 100px; }
	.big-action-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
	.big-action-icon { font-size: 36px; flex-shrink: 0; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3)); }
	.big-action-text { min-width: 0; }
	.big-action-text h3 { font-size: 16px; font-weight: 700; margin-bottom: 4px; white-space: nowrap; }
	.big-action-text p { font-size: 11px; opacity: 0.8; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.action-scan { background: linear-gradient(135deg, #1e40af, #3b82f6); }
	.action-compare { background: linear-gradient(135deg, #065f46, #10b981); }
	.action-seo { background: linear-gradient(135deg, #92400e, #f59e0b); }
	.action-team { background: linear-gradient(135deg, #581c87, #a855f7); }
	.action-crawl { background: linear-gradient(135deg, #164e63, #06b6d4); }
	.action-monitor { background: linear-gradient(135deg, #7f1d1d, #ef4444); }

	/* ── Scan Table ────────────────────────── */
	.scan-table-header { display: grid; grid-template-columns: 2fr 80px 100px 30px; gap: 8px; padding: 10px 16px; font-size: 11px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid var(--clr-border); }
	.scan-table-row { display: grid; grid-template-columns: 2fr 80px 100px 30px; gap: 8px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--clr-border); text-decoration: none; color: inherit; transition: background var(--duration-fast); cursor: default; }
	.scan-table-row:hover { background: rgba(255,255,255,0.02); }
	.scan-table-row:last-child { border-bottom: none; }
	.st-website { display: flex; align-items: center; gap: 10px; overflow: hidden; }
	.st-website span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--clr-text-secondary); }
	.st-score { display: flex; align-items: center; gap: 5px; font-size: 16px; font-weight: 800; }
	.trend-icon { flex-shrink: 0; opacity: 0.6; }
	.st-date { font-size: 11px; }
	.st-trend { display: flex; justify-content: center; }

	/* ── History ───────────────────────────── */
	.history-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--clr-border); }
	.history-row:last-child { border-bottom: none; }
	.favicon { width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0; }
	.history-url { flex: 1; font-size: 13px; color: var(--clr-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
	.history-score { font-size: 18px; font-weight: 800; flex-shrink: 0; }
	.history-date { font-size: 11px; flex-shrink: 0; }

	.empty-state { padding: var(--space-xl); text-align: center; }
	.upgrade-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--clr-gold-dim); border: 1px solid rgba(240,165,0,0.2); border-radius: var(--radius-md); font-size: 13px; margin-bottom: var(--space-md); }

	/* ── Profile Form ─────────────────────── */
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.field-hint { font-size: 11px; margin-top: 4px; display: block; }
	.hint-ok { color: var(--clr-success); }
	.hint-err { color: var(--clr-danger); }

	/* ── Plan Comparison ──────────────────── */
	.plan-compare { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
	.compare-col { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px; text-align: center; }
	.compare-col.featured { border-color: var(--clr-gold); box-shadow: var(--shadow-glow-gold); }
	.compare-header { font-weight: 700; font-size: 14px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--clr-border); }
	.compare-header.pro { color: var(--clr-gold); }
	.compare-header.agency { color: var(--clr-blue); }
	.compare-feat { font-size: 12px; color: var(--clr-text-secondary); padding: 3px 0; }
	.compare-feat.dim { color: var(--clr-text-muted); opacity: 0.5; }
	.active-plan { border-color: var(--clr-success); box-shadow: 0 0 0 1px var(--clr-success); }

	/* ── API Keys ─────────────────────────── */
	.key-reveal { margin-top: 12px; padding: 12px; background: var(--clr-bg-primary); border: 1px solid var(--clr-border); border-radius: var(--radius-md); }
	.key-code { display: block; font-family: var(--font-mono); font-size: 12px; color: var(--clr-gold); word-break: break-all; padding: 8px; background: var(--clr-bg-deep); border-radius: var(--radius-sm); margin-top: 4px; }
	.key-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--clr-border); }
	.key-row:last-child { border-bottom: none; }

	.rp-link-card { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; font-size: 12px; color: var(--clr-text-secondary); text-decoration: none; border: 1px solid var(--clr-border); border-radius: var(--radius-md); margin-bottom: 6px; transition: all var(--duration-fast); }
	.rp-link-card:hover { border-color: var(--clr-gold); color: var(--clr-gold); background: rgba(240,165,0,0.04); transform: translateX(2px); }
	.team-avatars { display: flex; gap: -4px; margin: 8px 0; }
	.team-avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: var(--clr-bg-card); border: 2px solid var(--clr-border); display: flex; align-items: center; justify-content: center; font-size: 14px; margin-left: -6px; }
	.team-avatar-sm:first-child { margin-left: 0; }
	.team-avatar-sm.plus { background: var(--clr-gold-dim); color: var(--clr-gold); font-weight: 700; font-size: 12px; cursor: pointer; }

	textarea.input { font-family: inherit; }

	/* ── Responsive ────────────────────────── */
	.referral-card { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px; margin-bottom: var(--space-md); }

	@media (max-width: 1100px) {
		.dash-layout { grid-template-columns: 180px 1fr; width: 100%; }
		.right-panel { display: none; }
	}
	@media (max-width: 768px) {
		.dash-layout { grid-template-columns: 1fr; border: none; border-radius: 0; width: 100%; left: 0; transform: none; min-height: auto; }
		.sidebar { flex-direction: row; flex-wrap: wrap; border-right: none; border-bottom: 1px solid var(--clr-border); padding: var(--space-xs); }
		.sidebar-avatar-wrap { flex-direction: row; gap: 10px; border-bottom: none; margin-bottom: 0; padding: 8px 12px; width: 100%; }
		.sidebar-avatar { width: 36px; height: 36px; }
		.avatar-letter { font-size: 16px; }
		.sidebar-name { margin-top: 0; font-size: 13px; }
		.sidebar-email { display: none; }
		.sidebar-avatar-wrap .plan-badge { display: none; }
		.sidebar-nav { display: flex; gap: 2px; overflow-x: auto; padding: 4px 8px; width: 100%; }
		.sidebar-item { padding: 8px 10px; border-radius: var(--radius-md); white-space: nowrap; font-size: 12px; }
		.sidebar-item.active { border-left: none; padding-left: 10px; border-radius: var(--radius-md); }
		.sidebar-footer { display: flex; gap: 2px; border-top: none; padding: 0 8px 4px; margin-top: 0; }
		.sidebar-footer .sidebar-item { padding: 8px 10px; border-radius: var(--radius-md); }
		.dash-main { padding: 16px 12px; }
		.action-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
		.big-action-card { padding: 14px; min-height: 80px; }
		.big-action-icon { font-size: 28px; }
		.big-action-text h3 { font-size: 14px; }
		.big-action-text p { font-size: 10px; -webkit-line-clamp: 1; }
	}
	@media (max-width: 480px) {
		.action-grid { grid-template-columns: 1fr; }
		.stats-grid { grid-template-columns: 1fr 1fr 1fr; }
		.stat-card { padding: 10px; }
		.stat-value { font-size: 16px; }
		.stat-label { font-size: 9px; }
		.sidebar-label { display: none; }
		.sidebar-item { padding: 8px; justify-content: center; }
		.scan-table-header { display: none; }
		.scan-table-row { grid-template-columns: 2fr 50px 80px; }
		.st-trend { display: none; }
	}
	@media (max-width: 640px) {
		.form-grid { grid-template-columns: 1fr; }
		.plan-compare { grid-template-columns: 1fr; }
	}
	/* Email verification banner */
	.verify-banner { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: var(--radius-lg); margin-bottom: 16px; overflow: hidden; }
	.verify-banner-inner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
</style>
