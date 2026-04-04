<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { formatDate, scoreColor } from '$lib/utils/score';
	import { safeFaviconUrl, safeGetStorage, safeSetStorage, safeRedirect, isValidEmail } from '$lib/utils/security';
	import * as api from '$lib/api/client';
	import type { ScanResult } from '$lib/types';
	import Seo from '$lib/components/ui/Seo.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { LayoutDashboard, User, CreditCard, ClipboardList, Key, Palette, ShieldCheck, Search, Scale, Target, Users, Gift, Link2, Trophy, MessageCircle, Camera, BarChart3 } from '@lucide/svelte';

	// ── Auth form state ──────────────────────────────────
	let isRegister = $state(false);
	let authEmail = $state('');
	let authPassword = $state('');
	let authName = $state('');
	let authError = $state('');
	let authPassword2 = $state('');
	let agreedTerms = $state(false);
	let agreedMarketing = $state(false);
	let authDob = $state('');
	let authLoading = $state(false);
	let showReinstate = $state(false);
	let reinstateLoading = $state(false);
	let reinstateMsg = $state('');
	let googleLoading = $state(false);
	let passkeyLoading = $state(false);

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
	let showVerifyPrompt = $state(false);
	let verifyPromptEmail = $state('');
	let showCodeInput = $state(false);
	let verificationCode = $state('');
	let codeSending = $state(false);
	let codeError = $state('');
	let pendingName = $state('');
	let pendingPassword = $state('');
	let pendingEmail = $state('');
	let pendingDob = $state('');

	// ── Login Verification Code ─────────────────────────
	let showLoginCode = $state(false);
	let loginCode = $state('');
	let loginCodeError = $state('');
	let loginCodeLoading = $state(false);
	let loginCodeEmail = $state('');

	// ── Referral System ─────────────────────────────────
	let referralData = $state<any>(null);
	let referralLoading = $state(true);
	let claimLoading = $state(false);
	let claimMsg = $state('');

	// ── Dashboard tabs ───────────────────────────────────
	type Tab = 'overview' | 'profile' | 'billing' | 'history' | 'api-keys' | 'security' | 'branding' | 'reports' | 'api-usage';
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

	// ── Change Email state ───────────────────────────────
	let ceNewEmail = $state('');
	let cePassword = $state('');
	let ceLoading = $state(false);
	let ceMsg = $state('');
	let ceError = $state('');
	let ceCodeSent = $state(false);
	let ceCode = $state('');
	let ceVerifyLoading = $state(false);

	// ── Password state ───────────────────────────────────
	let pwCurrent = $state('');
	let pwNew = $state('');
	let pwConfirm = $state('');
	let pwError = $state('');
	let pwSuccess = $state('');

	// ── Deactivation state ──────────────────────────────
	let deactivateLoading = $state(false);
	let deactivateMsg = $state('');

	// __ Delete Account state
	let showDeleteConfirm = $state(false);
	let deleteConfirmText = $state('');
	let deleteLoading = $state(false);
	let deleteMsg = $state('');

	// ── GDPR state ─────────────────────────
	let gdprExportLoading = $state(false);
	let gdprExportMsg = $state('');
	let gdprDeletePassword = $state('');
	let gdprDeleteLoading = $state(false);
	let gdprDeleteMsg = $state('');
	let gdprDeleteError = $state('');
	let gdprDeletionPending = $state(false);
	let gdprCancelLoading = $state(false);

	// ── Blocked / Muted Users ──────────────────────────
	let blockedUsers = $state<any[]>([]);
	let mutedUsers = $state<any[]>([]);
	let blockedLoading = $state(true);
	let mutedLoading = $state(true);

	// ── 2FA state ──────────────────────────────────────
	let twoFaEnabled = $state(false);
	let twoFaSetupData = $state<{ secret: string; provisioning_uri: string } | null>(null);
	let twoFaCode = $state('');
	let twoFaLoading = $state(false);
	let twoFaMsg = $state('');
	let twoFaError = $state('');
	let twoFaBackupCodes = $state<string[]>([]);
	let twoFaDisableCode = $state('');
	let twoFaDisablePassword = $state('');

	// ── Sessions & Login History state ────────────────
	let sessions = $state<any[]>([]);
	let sessionsLoading = $state(true);
	let revokeLoadingId = $state<string | null>(null);
	let loginHistory = $state<any[]>([]);
	let loginHistoryLoading = $state(true);

	// ── GDPR Consent state ───────────────────────────
	let consents = $state<any[]>([]);
	let consentsLoading = $state(true);

	// ── Content Appeals state ─────────────────────────
	let appeals = $state<any[]>([]);
	let appealsLoading = $state(true);

	// ── Notification Preferences state ────────────────
	let notifPrefs = $state<Record<string, boolean>>({});
	let notifPrefsLoading = $state(true);
	let notifPrefsSaving = $state(false);
	let notifPrefsMsg = $state('');

	// ── 2FA Recovery state ────────────────────────────
	let show2faRecover = $state(false);
	let recoverEmail = $state('');
	let recoverCode = $state('');
	let recoverLoading = $state(false);
	let recoverMsg = $state('');
	let recoverError = $state('');

	// ── Passkey state ──────────────────────────────────
	let passkeyRegLoading = $state(false);
	let passkeyRegMsg = $state('');
	let passkeyRegError = $state('');

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

	// ── ID Verification state ────────────────────────
	let idVerifStatus = $state<any>(null);
	let idVerifLoading = $state(true);
	let idVerifDocUrl = $state('');
	let idVerifDocType = $state('passport');
	let idVerifFullName = $state('');
	let idVerifSubmitting = $state(false);
	let idVerifMsg = $state('');
	let idVerifError = $state('');

	// ── E2E Key Backup state ─────────────────────────
	let e2eHasKey = $state(false);
	let e2eBackupPassphrase = $state('');
	let e2eBackupLoading = $state(false);
	let e2eBackupMsg = $state('');
	let e2eBackupError = $state('');
	let e2eRestorePassphrase = $state('');
	let e2eRestoreLoading = $state(false);
	let e2eRestoreMsg = $state('');
	let e2eRestoreError = $state('');
	let e2eHasBackup = $state(false);

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

	async function loadBlockedUsers() {
		blockedLoading = true;
		try { blockedUsers = (await api.getBlockedUsers()).users || []; } catch { blockedUsers = []; }
		blockedLoading = false;
	}

	async function loadMutedUsers() {
		mutedLoading = true;
		try { mutedUsers = (await api.getMutedUsers()).users || []; } catch { mutedUsers = []; }
		mutedLoading = false;
	}

	async function loadSessions() {
		sessionsLoading = true;
		try { sessions = (await api.getSessions()).sessions || []; } catch { sessions = []; }
		sessionsLoading = false;
	}

	async function handleRevokeSession(tokenId: string) {
		revokeLoadingId = tokenId;
		try {
			await api.revokeSession(tokenId);
			sessions = sessions.filter(s => s.id !== tokenId);
		} catch {}
		revokeLoadingId = null;
	}

	async function loadLoginHistory() {
		loginHistoryLoading = true;
		try { loginHistory = (await api.getLoginHistory()).history || []; } catch { loginHistory = []; }
		loginHistoryLoading = false;
	}

	async function handleUnblock(username: string) {
		try { await api.unblockUser(username); blockedUsers = blockedUsers.filter(u => u.username !== username); } catch {}
	}

	async function handleUnmute(username: string) {
		try { await api.unmuteUser(username); mutedUsers = mutedUsers.filter(u => u.username !== username); } catch {}
	}

	async function handleLogoutAll() {
		if (!confirm('This will sign you out on every device. Continue?')) return;
		try { await api.logoutAll(); auth.logout(); window.location.href = '/account'; } catch {}
	}

	async function handleChangeEmail() {
		ceLoading = true; ceError = ''; ceMsg = '';
		try {
			const res = await api.changeEmail(ceNewEmail.trim(), cePassword);
			ceMsg = res.message;
			ceCodeSent = true;
		} catch (err: any) { ceError = err?.message || 'Failed to send verification code'; }
		ceLoading = false;
	}

	async function handleVerifyEmailChange() {
		ceVerifyLoading = true; ceError = '';
		try {
			const res = await api.verifyEmailChange(ceCode.trim());
			ceMsg = 'Email updated successfully!';
			ceCodeSent = false; ceNewEmail = ''; cePassword = ''; ceCode = '';
			await auth.refresh();
		} catch (err: any) { ceError = err?.message || 'Invalid verification code'; }
		ceVerifyLoading = false;
	}

	async function handleDeactivate() {
		if (!confirm('Deactivate your account? Your profile and posts will be hidden. You can reactivate by logging in again.')) return;
		deactivateLoading = true; deactivateMsg = '';
		try {
			const res = await api.deactivateAccount();
			deactivateMsg = res.message;
			auth.logout();
			setTimeout(() => { window.location.href = '/account'; }, 2000);
		} catch (err: any) { deactivateMsg = err?.message || 'Failed to deactivate'; }
		deactivateLoading = false;
	}

	async function handle2faRecover() {
		recoverLoading = true; recoverError = ''; recoverMsg = '';
		try {
			const res = await api.recover2fa(recoverEmail.trim(), recoverCode.trim());
			if (res.access_token) {
				await auth.loginWithToken(res.access_token, res.refresh_token);
				recoverMsg = 'Recovery successful! Logging you in...';
				setTimeout(() => { show2faRecover = false; loadDashboard(); }, 1500);
			}
		} catch (err: any) { recoverError = err?.message || 'Invalid backup code'; }
		recoverLoading = false;
	}

	async function loadConsents() {
		consentsLoading = true;
		try { consents = (await api.getConsentStatus()).consents || []; } catch { consents = []; }
		consentsLoading = false;
	}

	async function loadAppeals() {
		appealsLoading = true;
		try { appeals = (await api.getAppealStatus()).appeals || []; } catch { appeals = []; }
		appealsLoading = false;
	}

	async function loadNotifPrefs() {
		notifPrefsLoading = true;
		try { notifPrefs = await api.getNotificationPreferences(); } catch { notifPrefs = {}; }
		notifPrefsLoading = false;
	}

	async function toggleNotifPref(key: string) {
		const newVal = !notifPrefs[key];
		notifPrefs[key] = newVal;
		notifPrefsSaving = true; notifPrefsMsg = '';
		try {
			await api.updateNotificationPreferences({ [key]: newVal });
			notifPrefsMsg = 'Saved';
			setTimeout(() => { notifPrefsMsg = ''; }, 1500);
		} catch { notifPrefs[key] = !newVal; }
		notifPrefsSaving = false;
	}

	async function loadIdVerifStatus() {
		idVerifLoading = true;
		try { idVerifStatus = await api.getIdVerificationStatus(); } catch { idVerifStatus = null; }
		idVerifLoading = false;
	}

	async function submitIdVerification() {
		if (!idVerifDocUrl.trim() || !idVerifFullName.trim()) { idVerifError = 'All fields required'; return; }
		idVerifSubmitting = true; idVerifMsg = ''; idVerifError = '';
		try {
			const res = await api.submitIdVerification(idVerifDocUrl.trim(), idVerifDocType, idVerifFullName.trim());
			idVerifMsg = res.message || 'Verification submitted';
			idVerifDocUrl = ''; idVerifFullName = '';
			await loadIdVerifStatus();
		} catch (e) { idVerifError = e instanceof Error ? e.message : 'Submission failed'; }
		idVerifSubmitting = false;
	}

	async function handle2faSetup() {
		twoFaLoading = true; twoFaError = ''; twoFaMsg = '';
		try {
			const data = await api.setup2fa();
			twoFaSetupData = data;
		} catch (err) { twoFaError = err instanceof Error ? err.message : 'Failed to setup 2FA'; }
		twoFaLoading = false;
	}

	async function handle2faVerify() {
		if (!twoFaCode || twoFaCode.length !== 6) { twoFaError = 'Enter 6-digit code'; return; }
		twoFaLoading = true; twoFaError = '';
		try {
			const res = await api.verify2fa(twoFaCode);
			twoFaEnabled = true;
			twoFaBackupCodes = res.backup_codes || [];
			twoFaSetupData = null;
			twoFaCode = '';
			twoFaMsg = '2FA enabled successfully! Save your backup codes.';
		} catch (err) { twoFaError = err instanceof Error ? err.message : 'Invalid code'; }
		twoFaLoading = false;
	}

	async function handle2faDisable() {
		if (!twoFaDisableCode || !twoFaDisablePassword) { twoFaError = 'Enter code and password'; return; }
		twoFaLoading = true; twoFaError = '';
		try {
			await api.disable2fa(twoFaDisableCode, twoFaDisablePassword);
			twoFaEnabled = false;
			twoFaMsg = '2FA disabled.';
			twoFaDisableCode = ''; twoFaDisablePassword = '';
		} catch (err) { twoFaError = err instanceof Error ? err.message : 'Failed to disable 2FA'; }
		twoFaLoading = false;
	}

	async function handlePasskeyRegister() {
		passkeyRegLoading = true; passkeyRegError = ''; passkeyRegMsg = '';
		try {
			const options = await api.getPasskeyRegisterOptions();
			options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
			options.user.id = Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
			if (options.excludeCredentials) {
				options.excludeCredentials = options.excludeCredentials.map((c: any) => ({ ...c, id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)) }));
			}
			const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
			if (!credential) { passkeyRegError = 'Registration cancelled'; passkeyRegLoading = false; return; }
			const response = credential.response as AuthenticatorAttestationResponse;
			const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
			await api.verifyPasskeyRegister({
				id: credential.id,
				rawId: toB64(credential.rawId),
				type: credential.type,
				response: {
					attestationObject: toB64(response.attestationObject),
					clientDataJSON: toB64(response.clientDataJSON)
				}
			});
			passkeyRegMsg = 'Passkey registered successfully!';
		} catch (err) { passkeyRegError = err instanceof Error ? err.message : 'Passkey registration failed'; }
		passkeyRegLoading = false;
	}

	async function handleGdprExport() {
		gdprExportLoading = true; gdprExportMsg = '';
		try {
			const data = await api.gdprExport();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = 'wisers-data.json'; a.click();
			URL.revokeObjectURL(url);
			gdprExportMsg = 'Download started!';
		} catch (err) {
			gdprExportMsg = err instanceof Error ? err.message : 'Export failed';
		}
		gdprExportLoading = false;
	}

	async function handleGdprDelete() {
		if (!gdprDeletePassword) { gdprDeleteError = 'Password required'; return; }
		gdprDeleteLoading = true; gdprDeleteError = ''; gdprDeleteMsg = '';
		try {
			await api.gdprDeleteRequest(gdprDeletePassword);
			gdprDeleteMsg = 'Account deletion scheduled. You have 30 days to cancel.';
			gdprDeletionPending = true;
			gdprDeletePassword = '';
		} catch (err) {
			gdprDeleteError = err instanceof Error ? err.message : 'Failed to request deletion';
		}
		gdprDeleteLoading = false;
	}

	async function handleGdprCancelDeletion() {
		gdprCancelLoading = true;
		try {
			await api.gdprCancelDeletion();
			gdprDeletionPending = false;
			gdprDeleteMsg = 'Deletion cancelled. Your account is safe.';
		} catch (err) {
			gdprDeleteError = err instanceof Error ? err.message : 'Failed to cancel';
		}
		gdprCancelLoading = false;
	}

	async function backupE2EKey() {
		if (e2eBackupPassphrase.length < 8) { e2eBackupError = 'Passphrase must be at least 8 characters'; return; }
		e2eBackupLoading = true; e2eBackupError = ''; e2eBackupMsg = '';
		try {
			const { encryptPrivateKeyWithPassphrase, getPublicKey } = await import('$lib/stores/encryption');
			// Validate the key with backend before backing up
			const pubKey = getPublicKey();
			if (pubKey) {
				try {
					const validation = await api.validateEncryptionKey(pubKey);
					if (!validation.valid) { e2eBackupError = validation.error || 'Encryption key is invalid'; e2eBackupLoading = false; return; }
				} catch { /* validation endpoint unavailable, proceed anyway */ }
			}
			const encrypted = encryptPrivateKeyWithPassphrase(e2eBackupPassphrase);
			if (!encrypted) { e2eBackupError = 'No encryption key found. Send a message first to generate one.'; e2eBackupLoading = false; return; }
			await api.backupKey(encrypted);
			e2eBackupMsg = 'Key backed up successfully. Keep your passphrase safe!';
			e2eHasBackup = true;
			e2eBackupPassphrase = '';
		} catch (err) {
			e2eBackupError = err instanceof Error ? err.message : 'Backup failed';
		}
		e2eBackupLoading = false;
	}

	async function restoreE2EKey() {
		if (!e2eRestorePassphrase) { e2eRestoreError = 'Enter your backup passphrase'; return; }
		e2eRestoreLoading = true; e2eRestoreError = ''; e2eRestoreMsg = '';
		try {
			const backup = await api.getKeyBackup();
			if (!backup || !backup.encrypted_key) { e2eRestoreError = 'No backup found on server'; e2eRestoreLoading = false; return; }
			const { decryptPrivateKeyWithPassphrase } = await import('$lib/stores/encryption');
			const ok = decryptPrivateKeyWithPassphrase(backup.encrypted_key, e2eRestorePassphrase);
			if (ok) {
				e2eRestoreMsg = 'Key restored successfully! Your encrypted messages will now be readable.';
				e2eHasKey = true;
				e2eRestorePassphrase = '';
			} else {
				e2eRestoreError = 'Wrong passphrase. Please try again.';
			}
		} catch (err) {
			e2eRestoreError = err instanceof Error ? err.message : 'Restore failed';
		}
		e2eRestoreLoading = false;
	}

	async function deleteE2EBackup() {
		if (!confirm('Delete your key backup from the server? You will not be able to restore your encryption key on a new device.')) return;
		try {
			await api.deleteKeyBackup();
			e2eHasBackup = false;
			e2eBackupMsg = 'Backup deleted from server.';
		} catch {}
	}

	const user = $derived($auth.user);
	const plan = $derived(user?.plan || 'free');
	const planLabel = $derived(plan.charAt(0).toUpperCase() + plan.slice(1));
	const isPaid = $derived(plan === 'pro' || plan === 'agency');
	const isAgency = $derived(plan === 'agency');

	onMount(async () => {
		const saved = safeGetStorage('bscan_email');
		if (saved) authEmail = saved;
		if (user) loadDashboard();
		// Check E2E key state
		try {
			const { hasKeyPair } = await import('$lib/stores/encryption');
			e2eHasKey = hasKeyPair();
		} catch {}
		try {
			const backup = await api.getKeyBackup();
			e2eHasBackup = !!(backup && backup.encrypted_key);
		} catch {}
		// Load security data
		try { const s = await api.get2faStatus(); twoFaEnabled = s.enabled; } catch {}
		loadBlockedUsers();
		loadMutedUsers();
		loadSessions();
		loadLoginHistory();
		loadNotifPrefs();
		loadAppeals();
		loadConsents();
		loadIdVerifStatus();

		const params = new URLSearchParams(window.location.search);

		// Handle SSO token from Google OAuth callback
		const ssoToken = params.get('sso_token');
		if (ssoToken) {
			const ssoRefresh = params.get('refresh_token');
			window.history.replaceState({}, '', '/account');
			auth.loginWithToken(ssoToken, ssoRefresh || undefined).then((ok) => {
				if (ok) {
					loadDashboard();
				} else {
					authError = 'SSO token was invalid. Please sign in again.';
				}
			});
			initPushState();
			return;
		}

		// Handle password reset link
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
	let profileError = $state('');

	async function loadProfileData() {
		profileError = '';
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
		} catch (err) {
			profileError = err instanceof Error ? err.message : 'Unable to load account data.';
			console.error('loadProfileData failed:', err);
		}
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

	async function signInWithGoogle() {
		googleLoading = true;
		authError = '';
		try {
			const data = await api.getGoogleAuthUrl();
			if (data.url) {
				window.location.href = data.url;
			} else {
				authError = 'Google sign-in is not configured on the server.';
				googleLoading = false;
			}
		} catch (err: any) {
			authError = err.message || 'Could not start Google sign-in';
			googleLoading = false;
		}
	}

	async function signInWithPasskey() {
		passkeyLoading = true;
		authError = '';
		try {
			if (!window.PublicKeyCredential) {
				authError = 'Passkeys are not supported in this browser.';
				passkeyLoading = false;
				return;
			}

			const options = await api.getPasskeyLoginOptions();
			const challenge = Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0));
			const allowCredentials = (options.allowCredentials || []).map((cred: any) => ({
				...cred,
				id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0)),
			}));

			const credential = await navigator.credentials.get({
				publicKey: {
					challenge,
					rpId: options.rpId || window.location.hostname,
					allowCredentials,
					timeout: options.timeout || 60000,
					userVerification: options.userVerification || 'preferred',
				}
			});

			if (!credential) { passkeyLoading = false; return; }

			const assertionResponse = credential as PublicKeyCredential;
			const response = assertionResponse.response as AuthenticatorAssertionResponse;

			const data = await api.verifyPasskeyLogin({
				id: assertionResponse.id,
				rawId: btoa(String.fromCharCode(...new Uint8Array(assertionResponse.rawId))),
				response: {
					authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
					clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
					signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
				},
				type: assertionResponse.type,
			});

			const ok = await auth.loginWithToken(data.access_token, data.refresh_token);
			if (ok) {
				loadDashboard();
			} else {
				authError = 'Passkey authentication failed.';
			}
		} catch (err: any) {
			if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
				// User cancelled
			} else {
				authError = err.message || 'Passkey authentication failed';
			}
		} finally {
			passkeyLoading = false;
		}
	}

	async function handleAuth() {
		authError = '';
		if (!authEmail || !authPassword) { authError = 'Fill in all fields.'; return; }
		if (isRegister && !authName) { authError = 'Name is required.'; return; }
		if (isRegister && authPassword.length < 8) { authError = 'Password must be at least 8 characters.'; return; }
		if (isRegister && authPassword !== authPassword2) { authError = 'Passwords do not match.'; return; }
		if (isRegister && !authDob) { authError = 'Date of birth is required.'; return; }
		if (isRegister && authDob) {
			const d = new Date(authDob), t = new Date();
			let age = t.getFullYear() - d.getFullYear();
			const m = t.getMonth() - d.getMonth();
			if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
			if (age < 13) { authError = 'You must be at least 13 years old.'; return; }
		}
		authLoading = true;
		try {
			if (isRegister) {
				// Step 1: Send verification code
				await api.sendCode(authEmail);
				pendingName = authName;
				pendingEmail = authEmail;
				pendingPassword = authPassword;
				pendingDob = authDob;
				showCodeInput = true;
				authLoading = false;
				return;
			} else {
				const result = await auth.login(authEmail, authPassword);
				if (result.requires_verification) {
					loginCodeEmail = authEmail;
					showLoginCode = true;
					loginCode = '';
					loginCodeError = '';
					authLoading = false;
					return;
				}
			}
			loadDashboard();
		} catch (err) {
			let msg = 'Something went wrong. Please try again.';
			if (err instanceof Error) msg = err.message;
			else if (typeof err === 'string') msg = err;
			if (msg.includes('[object')) msg = 'Something went wrong. Please try again.';
			if (msg.includes('ACCOUNT_DELETED')) {
				showReinstate = true;
				authError = '';
			} else if (msg.includes('EMAIL_NOT_VERIFIED')) {
				showVerifyPrompt = true;
				verifyPromptEmail = authEmail;
				authError = '';
			} else {
				authError = msg;
			}
		}
		authLoading = false;
	}

	async function handleReinstate() {
		if (!authEmail || !authPassword) { reinstateMsg = 'Enter your email and password above.'; return; }
		reinstateLoading = true;
		reinstateMsg = '';
		try {
			await api.reinstateAccount(authEmail, authPassword);
			reinstateMsg = 'Account reinstated! Logging you in...';
			showReinstate = false;
			setTimeout(async () => {
				try { await auth.login(authEmail, authPassword); loadDashboard(); } catch {}
			}, 1500);
		} catch (err) {
			reinstateMsg = err instanceof Error ? err.message : 'Could not reinstate account.';
		}
		reinstateLoading = false;
	}

	async function handleLoginCode() {
		if (!loginCode || loginCode.length !== 6) { loginCodeError = 'Enter the 6-digit code.'; return; }
		loginCodeLoading = true;
		loginCodeError = '';
		try {
			await auth.verifyLoginCode(loginCodeEmail, loginCode);
			loadDashboard();
		} catch (err) {
			loginCodeError = err instanceof Error ? err.message : 'Invalid code. Try again.';
		}
		loginCodeLoading = false;
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

	// ── API Usage ────────────────────────────────────────
	let apiUsage = $state<any>(null);
	let apiUsageHistory = $state<any[]>([]);
	let apiUsageLogs = $state<any[]>([]);
	let apiUsageMonthly = $state<any[]>([]);
	let apiUsageLoading = $state(false);
	let apiLogsOffset = $state(0);

	async function loadApiUsage() {
		apiUsageLoading = true;
		try {
			const [usage, history, logs, monthly] = await Promise.allSettled([
				api.getApiUsage(),
				api.getApiUsageHistory(30),
				api.getApiUsageLogs(50, 0),
				api.getApiUsageMonthly(12)
			]);
			if (usage.status === 'fulfilled') apiUsage = usage.value;
			if (history.status === 'fulfilled') apiUsageHistory = history.value?.data || history.value?.history || [];
			if (logs.status === 'fulfilled') apiUsageLogs = logs.value?.logs || logs.value?.items || [];
			if (monthly.status === 'fulfilled') apiUsageMonthly = monthly.value?.data || monthly.value?.months || [];
		} catch {}
		apiUsageLoading = false;
	}

	$effect(() => {
		if (activeTab === 'api-usage' && !apiUsage && !apiUsageLoading) {
			loadApiUsage();
		}
	});

	async function loadMoreLogs() {
		apiLogsOffset += 50;
		try {
			const res = await api.getApiUsageLogs(50, apiLogsOffset);
			const more = res?.logs || res?.items || [];
			apiUsageLogs = [...apiUsageLogs, ...more];
		} catch {}
	}

	// ── Report Scheduling ────────────────────────────────
	let reportSchedules = $state<any[]>([]);
	let reportStats     = $state<any>(null);
	let reportLoading   = $state(true);
	let reportSaving    = $state(false);
	let reportMsg       = $state('');
	let reportError     = $state('');
	let showNewSchedule = $state(false);
	let sendingNow      = $state<string | null>(null);
	let rptHistoryOpen  = $state<string | null>(null);
	let rptHistoryData  = $state<Record<string, any[]>>({});
	let rptHistoryLoading = $state<string | null>(null);

	async function loadReportHistory(schedId: string) {
		if (rptHistoryOpen === schedId) { rptHistoryOpen = null; return; }
		rptHistoryOpen = schedId;
		if (rptHistoryData[schedId]) return;
		rptHistoryLoading = schedId;
		try {
			const res = await api.getReportHistory(schedId);
			rptHistoryData = { ...rptHistoryData, [schedId]: res.history || [] };
		} catch { rptHistoryData = { ...rptHistoryData, [schedId]: [] }; }
		rptHistoryLoading = null;
	}
	let newSched        = $state({
		url: '', recipient_email: '', recipient_name: '',
		frequency: 'monthly', branding_company: '',
		branding_color: '#D4AF37',
		include_ai_fixes: true, include_comparison: true
	});


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

	async function handleCodeVerify() {
		codeError = '';
		if (!verificationCode || verificationCode.length !== 6) {
			codeError = 'Please enter the 6-digit code.';
			return;
		}
		authLoading = true;
		try {
			await auth.register(pendingEmail, pendingPassword, pendingName, '', verificationCode, pendingDob);
			goto('/wisers');
		} catch (err) {
			let msg = err instanceof Error ? err.message : 'Verification failed.';
			if (msg.includes('expired') || msg.includes('not found')) codeError = 'That code has expired. Click Resend code to get a new one.';
			else if (msg.includes('Invalid')) codeError = 'That code is incorrect. Please check your email and try again.';
			else codeError = msg;
		} finally {
			authLoading = false;
		}
	}

	async function resendCode() {
		codeSending = true;
		codeError = '';
		try {
			await api.sendCode(pendingEmail);
			codeError = 'New code sent!';
		} catch (err) {
			codeError = 'Failed to resend. Wait a minute and try again.';
		} finally {
			codeSending = false;
		}
	}


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

	async function handleDeleteAccount() {
		if (deleteConfirmText !== 'DELETE') return;
		deleteLoading = true;
		deleteMsg = '';
		try {
			await api.deleteAccount();
			deleteMsg = 'Account deleted. You will be logged out.';
			setTimeout(() => auth.logout(), 3000);
		} catch (err) {
			deleteMsg = err instanceof Error ? err.message : 'Failed to delete account.';
		}
		deleteLoading = false;
	}


	// ── Report Functions ──────────────────────────────
	async function loadReports() {
		if (!isAgency) { reportLoading = false; return; }
		reportLoading = true;
		try {
			const [sched, stats] = await Promise.all([api.getReportSchedules(), api.getReportStats()]);
			reportSchedules = sched.schedules || [];
			reportStats = stats;
		} catch (e: any) { reportError = e.message || 'Failed to load reports'; }
		reportLoading = false;
	}

	async function createScheduleReport() {
		if (!newSched.url || !newSched.recipient_email) { reportError = 'URL and email required'; return; }
		reportSaving = true; reportError = '';
		try {
			await api.createReportSchedule(newSched);
			reportMsg = 'Schedule created'; showNewSchedule = false;
			newSched = { url: '', recipient_email: '', recipient_name: '', frequency: 'monthly', branding_company: '', branding_color: '#D4AF37', include_ai_fixes: true, include_comparison: true };
			await loadReports();
			setTimeout(() => reportMsg = '', 3000);
		} catch (e: any) { reportError = e.message || 'Failed'; }
		reportSaving = false;
	}

	async function toggleSched(id: string, cur: string) {
		try { await api.updateReportSchedule(id, { status: cur === 'active' ? 'paused' : 'active' }); await loadReports(); } catch (e: any) { reportError = e.message; }
	}

	async function deleteSched(id: string) {
		if (!confirm('Delete this scheduled report?')) return;
		try { await api.deleteReportSchedule(id); await loadReports(); } catch (e: any) { reportError = e.message; }
	}

	async function sendReportNow(id: string) {
		sendingNow = id;
		try { const r = await api.sendReportNow(id); reportMsg = r.message || 'Queued'; setTimeout(() => reportMsg = '', 5000); } catch (e: any) { reportError = e.message; }
		sendingNow = null;
	}



	function reportInit(node: HTMLElement) {
		if (isAgency) loadReports();
		return { destroy() {} };
	}

	const tabs: Array<{ key: Tab; label: string; icon: any; show?: () => boolean }> = [
		{ key: 'overview', label: 'Overview', icon: LayoutDashboard },
		{ key: 'profile', label: 'Profile', icon: User },
		{ key: 'billing', label: 'Billing', icon: CreditCard },
		{ key: 'history', label: 'History', icon: ClipboardList },
		{ key: 'api-keys', label: 'API Keys', icon: Key, show: () => isPaid },
		{ key: 'branding', label: 'Branding', icon: Palette, show: () => isAgency },
		{ key: 'reports', label: 'Reports', icon: Target },
		{ key: 'api-usage', label: 'API Usage', icon: BarChart3, show: () => isPaid },
		{ key: 'security', label: 'Security', icon: ShieldCheck },
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
	{#if showCodeInput}
	<div class="auth-section animate-fade-up" style="text-align: center;">
		<div style="font-size: 56px; margin-bottom: 16px;">&#9993;</div>
		<h2>Check your <span class="text-gold">email</span></h2>
		<p class="text-muted" style="margin-bottom: 8px;">We sent a 6-digit verification code to</p>
		<p style="font-weight: 600; margin-bottom: 24px; color: var(--clr-gold);">{pendingEmail}</p>
		<input class="input" type="text" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" style="text-align: center; font-size: 32px; letter-spacing: 10px; font-family: var(--font-mono); max-width: 280px; margin: 0 auto 16px;" bind:value={verificationCode} onkeydown={(e) => { if (e.key === 'Enter') handleCodeVerify(); }} />
		{#if codeError}<div class="msg-error" style="margin-bottom: 12px;">{codeError}</div>{/if}
		<button class="btn btn-gold" style="width: 100%; max-width: 280px; margin: 0 auto;" disabled={authLoading} onclick={handleCodeVerify}>
			{#if authLoading}<span class="spinner spinner-sm"></span> Verifying...{:else}Verify & Create Account{/if}
		</button>
		<div style="margin-top: 20px; display: flex; justify-content: center; gap: 16px;">
			<button style="background: none; border: none; color: var(--clr-text-muted); font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline;" disabled={codeSending} onclick={resendCode}>{codeSending ? 'Sending...' : 'Resend code'}</button>
			<button style="background: none; border: none; color: var(--clr-text-muted); font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline;" onclick={() => { showCodeInput = false; verificationCode = ''; codeError = ''; }}>Use different email</button>
		</div>
		<p class="text-muted" style="margin-top: 16px; font-size: 11px;">Code expires in 10 minutes. Check spam if you don't see it.</p>
	</div>
	{:else if showLoginCode}
	<!-- ══════ LOGIN VERIFICATION CODE ══════ -->
	<div class="auth-section animate-fade-up" style="text-align: center;">
		<div style="font-size: 56px; margin-bottom: 16px;">&#128274;</div>
		<h2>Verify your <span class="text-gold">login</span></h2>
		<p class="text-muted" style="margin-bottom: 8px;">We sent a 6-digit verification code to</p>
		<p style="font-weight: 600; margin-bottom: 24px; color: var(--clr-gold);">{loginCodeEmail}</p>
		<input class="input" type="text" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" style="text-align: center; font-size: 32px; letter-spacing: 10px; font-family: var(--font-mono); max-width: 280px; margin: 0 auto 16px;" bind:value={loginCode} onkeydown={(e) => { if (e.key === 'Enter') handleLoginCode(); }} />
		{#if loginCodeError}<div class="msg-error" style="margin-bottom: 12px;">{loginCodeError}</div>{/if}
		<button class="btn btn-gold" style="width: 100%; max-width: 280px; margin: 0 auto;" disabled={loginCodeLoading} onclick={handleLoginCode}>
			{#if loginCodeLoading}<span class="spinner spinner-sm"></span> Verifying...{:else}Verify & Sign In{/if}
		</button>
		<div style="margin-top: 20px;">
			<button style="background: none; border: none; color: var(--clr-text-muted); font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline;" onclick={() => { showLoginCode = false; loginCode = ''; loginCodeError = ''; }}>Back to login</button>
		</div>
		<p class="text-muted" style="margin-top: 16px; font-size: 11px;">Code expires in 5 minutes. Check spam if you don't see it.</p>
		<button style="background: none; border: none; color: var(--clr-text-muted); font-size: 12px; cursor: pointer; font-family: inherit; text-decoration: underline; margin-top: 8px;" onclick={() => { show2faRecover = true; showLoginCode = false; recoverEmail = loginCodeEmail; }}>Lost access to authenticator? Use backup code</button>
	</div>
	{:else if show2faRecover}
	<!-- ══════ 2FA BACKUP CODE RECOVERY ══════ -->
	<div class="auth-section animate-fade-up" style="text-align: center;">
		<div style="font-size: 56px; margin-bottom: 16px;">&#128273;</div>
		<h2>Recover with <span class="text-gold">backup code</span></h2>
		<p class="text-muted" style="margin-bottom: 20px;">Enter your email and one of your saved backup codes to sign in.</p>
		<div style="max-width: 320px; margin: 0 auto; text-align: left;">
			<div class="field" style="margin-bottom: 12px;">
				<label class="label" for="recover-email">Email</label>
				<input class="input" type="email" id="recover-email" bind:value={recoverEmail} />
			</div>
			<div class="field" style="margin-bottom: 12px;">
				<label class="label" for="recover-code">Backup Code</label>
				<input class="input" type="text" id="recover-code" placeholder="xxxx-xxxx-xxxx" bind:value={recoverCode} style="font-family: monospace; letter-spacing: 1px;" />
			</div>
			{#if recoverError}<div class="msg-error" style="margin-bottom: 12px;">{recoverError}</div>{/if}
			{#if recoverMsg}<div class="msg-success" style="margin-bottom: 12px;">{recoverMsg}</div>{/if}
			<button class="btn btn-gold" style="width: 100%;" disabled={recoverLoading || !recoverEmail || !recoverCode} onclick={handle2faRecover}>
				{recoverLoading ? 'Recovering...' : 'Sign In with Backup Code'}
			</button>
		</div>
		<div style="margin-top: 16px;">
			<button style="background: none; border: none; color: var(--clr-text-muted); font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline;" onclick={() => { show2faRecover = false; }}>Back to login</button>
		</div>
	</div>
	{:else}
	<!-- ══════ AUTH FORM ══════ -->
	{#if !isRegister}
	<!-- ── SPLIT LOGIN LAYOUT (X-style) ── -->
	<div class="auth-section animate-fade-up" style="max-width: 100%; padding: 0; min-height: 60vh; background: radial-gradient(ellipse at top center, rgba(30, 25, 15, 0.8) 0%, #0c0c0c 60%); display: flex; flex-direction: row; align-items: stretch; justify-content: center;">
		<!-- LEFT SIDE: BS Logo -->
		<div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 60vh;">
			<svg viewBox="0 0 200 120" style="width: 280px; max-width: 80%; opacity: 0.7;">
				<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" style="font-size: 96px; font-weight: 900; font-family: inherit; fill: #6b7280; letter-spacing: -4px;">BS</text>
			</svg>
		</div>

		<!-- RIGHT SIDE: Login Form -->
		<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 40px; min-height: 60vh;">
			<div style="width: 100%; max-width: 380px;">
				<h1 style="font-size: 2.25rem; font-weight: 800; color: #fff; margin: 0 0 12px 0; line-height: 1.15;">Build with BSCAN</h1>
				<p style="color: var(--clr-text-secondary); font-size: 15px; margin: 0 0 32px 0; line-height: 1.5;">Access your dashboard, scan history, and settings.</p>

				<!-- Social sign-in buttons -->
				<div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
					<button
						style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 12px 16px; border-radius: 9999px; border: 1px solid var(--clr-border); background: #fff; color: #1f2937; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.15s;"
						disabled={googleLoading}
						onclick={signInWithGoogle}
					>
						{#if googleLoading}
							<span class="spinner spinner-sm"></span>
						{:else}
							<svg style="width: 18px; height: 18px;" viewBox="0 0 24 24">
								<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
								<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
								<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.84z" fill="#FBBC05"/>
								<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
							</svg>
						{/if}
						Sign in with Google
					</button>

					<button
						style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 12px 16px; border-radius: 9999px; border: 1px solid var(--clr-border); background: #fff; color: #1f2937; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.15s;"
						disabled={passkeyLoading}
						onclick={signInWithPasskey}
					>
						{#if passkeyLoading}
							<span class="spinner spinner-sm"></span>
						{:else}
							<svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="#1f2937" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"/>
							</svg>
						{/if}
						Sign in with a Passkey
					</button>
				</div>

				<!-- OR divider -->
				<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
					<div style="flex: 1; height: 1px; background: var(--clr-border);"></div>
					<span style="font-size: 12px; font-weight: 500; color: var(--clr-text-muted);">OR</span>
					<div style="flex: 1; height: 1px; background: var(--clr-border);"></div>
				</div>

				<!-- Email / Password fields -->
				<div class="field" style="margin-bottom: 12px;">
					<input class="input" type="email" id="a-email" placeholder="Email" autocomplete="email" bind:value={authEmail} onkeydown={kd} style="width: 100%; box-sizing: border-box;" />
				</div>
				<div class="field" style="margin-bottom: 4px;">
					<input class="input" type="password" id="a-pw" placeholder="Password" bind:value={authPassword} onkeydown={kd} style="width: 100%; box-sizing: border-box;" />
				</div>

				{#if authError}<div class="msg-error">{authError}</div>{/if}

				<button
					style="width: 100%; margin-top: 16px; padding: 12px 16px; border-radius: 9999px; border: none; background: #f5a623; color: #000; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: opacity 0.15s;"
					disabled={authLoading}
					onclick={handleAuth}
				>
					{#if authLoading}<span class="spinner spinner-sm"></span>{/if}
					Sign In
				</button>

				<!-- Terms text -->
				<p style="font-size: 11px; color: var(--clr-text-muted); margin-top: 16px; line-height: 1.5; text-align: center;">
					By signing in, you agree to the <a href="https://balancewises.io/terms" target="_blank" style="color: var(--clr-gold); text-decoration: underline;">Terms of Service</a> and <a href="https://balancewises.io/privacy" target="_blank" style="color: var(--clr-gold); text-decoration: underline;">Privacy Policy</a>, including <a href="https://balancewises.io/cookies" target="_blank" style="color: var(--clr-gold); text-decoration: underline;">Cookie Use</a>.
				</p>

				<!-- Don't have an account? -->
				<div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--clr-border); text-align: center;">
					<p style="font-size: 14px; color: var(--clr-text-muted); margin: 0 0 16px 0;">Don't have an account?</p>
					<button
						style="width: 100%; padding: 12px 16px; border-radius: 9999px; border: 1px solid var(--clr-gold); background: transparent; color: var(--clr-gold); font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s;"
						onclick={() => { isRegister = true; authError = ''; }}
					>
						Sign up
					</button>
				</div>

				<!-- Forgot password -->
				{#if !showForgot}
					<div style="text-align: center; margin-top: 12px;">
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

				{#if showReinstate}
					<div style="margin-top: 16px; padding: 16px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius-lg);">
						<p style="font-size: 14px; font-weight: 600; color: var(--clr-warning); margin-bottom: 8px;">Account Deleted</p>
						<p class="text-muted" style="font-size: 12px; margin-bottom: 12px; line-height: 1.6;">Your account was previously deleted. Your data has been kept for 6 months. You can reinstate your account now to regain full access.</p>
						{#if reinstateMsg}<div style="padding: 10px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 12px; margin-bottom: 12px;">{reinstateMsg}</div>{/if}
						<button class="btn btn-gold" style="width: 100%;" disabled={reinstateLoading} onclick={handleReinstate}>
							{#if reinstateLoading}Reinstating...{:else}Reinstate My Account{/if}
						</button>
						<button class="toggle-link" style="display: block; text-align: center; margin-top: 8px; font-size: 11px; color: var(--clr-text-muted);" onclick={() => { showReinstate = false; authError = ''; }}>Cancel</button>
					</div>
				{/if}

				{#if showVerifyPrompt}
					<div style="margin-top: 16px; padding: 20px; background: rgba(245,166,35,0.06); border: 1px solid rgba(245,166,35,0.15); border-radius: var(--radius-lg); text-align: center;">
						<div style="font-size: 28px; margin-bottom: 8px;">📧</div>
						<div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Verify your email</div>
						<div style="font-size: 13px; color: var(--clr-text-secondary); margin-bottom: 14px; line-height: 1.6;">
							We sent a verification link to <strong style="color: var(--clr-text-primary);">{verifyPromptEmail}</strong>.<br/>Check your inbox (and spam folder) and click the link to activate your account.
						</div>
						<button class="btn btn-gold" style="width: 100%;" disabled={resendLoading} onclick={async () => {
							resendLoading = true;
							verifyMsg = '';
							verifyError = '';
							try {
								const res = await api.resendVerificationByEmail(verifyPromptEmail);
								verifyMsg = res.message || 'Verification email sent! Check your inbox.';
							} catch (err) {
								verifyError = err instanceof Error ? err.message : 'Failed to resend. Try again later.';
							}
							resendLoading = false;
						}}>
							{#if resendLoading}<span class="spinner spinner-sm"></span> Sending...{:else}Resend Verification Email{/if}
						</button>
						{#if verifyMsg}<div class="msg-success" style="margin-top: 10px;">{verifyMsg}</div>{/if}
						{#if verifyError}<div class="msg-error" style="margin-top: 10px;">{verifyError}</div>{/if}
						<button style="margin-top: 12px; background: none; border: none; color: var(--clr-text-muted); font-size: 12px; cursor: pointer; font-family: inherit;" onclick={() => { showVerifyPrompt = false; }}>← Back to login</button>
					</div>
				{/if}

				<!-- Footer links -->
				<div style="margin-top: 32px; text-align: center; display: flex; flex-wrap: wrap; justify-content: center; gap: 16px;">
					<a href="https://balancewises.io" target="_blank" style="font-size: 12px; color: var(--clr-text-muted); text-decoration: none;">About</a>
					<a href="/" style="font-size: 12px; color: var(--clr-text-muted); text-decoration: none;">BSCAN</a>
					<a href="https://wisrs.com" target="_blank" style="font-size: 12px; color: var(--clr-text-muted); text-decoration: none;">Wisers</a>
					<a href="https://balancewises.io/terms" target="_blank" style="font-size: 12px; color: var(--clr-text-muted); text-decoration: none;">Terms</a>
					<a href="https://balancewises.io/privacy" target="_blank" style="font-size: 12px; color: var(--clr-text-muted); text-decoration: none;">Privacy</a>
					<a href="mailto:contact@balancewises.io" style="font-size: 12px; color: var(--clr-text-muted); text-decoration: none;">Contact</a>
				</div>
			</div>
		</div>
	</div>

	{:else}
	<!-- ── REGISTER FORM (original style) ── -->
	<div class="auth-section animate-fade-up">
		<h2>Create your <span class="text-gold">account</span></h2>
		<p class="text-secondary" style="margin-bottom: 24px;">
			Start tracking your website health.
		</p>

		<div class="field">
			<label class="label" for="a-name">Full name *</label>
			<input class="input" type="text" id="a-name" placeholder="Your name" bind:value={authName} onkeydown={kd} />
		</div>

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-email">Email address *</label>
			<input class="input" type="email" id="a-email" placeholder="you@company.com" autocomplete="email" bind:value={authEmail} onkeydown={kd} />
		</div>

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-pw">Password *</label>
			<input class="input" type="password" id="a-pw" placeholder="Minimum 8 characters" bind:value={authPassword} onkeydown={kd} />
		</div>

		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-pw2">Confirm password *</label>
			<input class="input" type="password" id="a-pw2" placeholder="Repeat your password" bind:value={authPassword2} onkeydown={kd} />
		</div>
		<div class="field" style="margin-top: 12px;">
			<label class="label" for="a-dob">Date of birth *</label>
			<input class="input" type="date" id="a-dob" bind:value={authDob} max={new Date().toISOString().split('T')[0]} style="color-scheme:dark" />
		</div>

		{#if authError}<div class="msg-error">{authError}</div>{/if}

		<div style="margin-top: 16px; display: flex; flex-direction: column; gap: 10px;">
			<label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-size: 12px; color: var(--clr-text-secondary); line-height: 1.4;">
				<input type="checkbox" bind:checked={agreedTerms} style="margin-top: 2px; accent-color: var(--clr-gold);" />
				<span>I agree to the <a href="https://balancewises.io/terms" target="_blank" style="color: var(--clr-gold); text-decoration: underline;">Terms & Conditions</a> and <a href="https://balancewises.io/privacy" target="_blank" style="color: var(--clr-gold); text-decoration: underline;">Privacy Policy</a> *</span>
			</label>
			<label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-size: 12px; color: var(--clr-text-secondary); line-height: 1.4;">
				<input type="checkbox" bind:checked={agreedMarketing} style="margin-top: 2px; accent-color: var(--clr-gold);" />
				<span>I'd like to receive product updates, tips, and offers from Balancewise Technologies</span>
			</label>
		</div>

		<button class="btn btn-gold" style="width: 100%; margin-top: 16px;" disabled={authLoading || !agreedTerms} onclick={handleAuth}>
			{#if authLoading}<span class="spinner spinner-sm"></span>{/if}
			Create Account
		</button>

		<div class="auth-toggle">
			<span class="text-muted">Already have an account?</span>
			<button class="toggle-link" onclick={() => { isRegister = false; authError = ''; }}>
				Sign in
			</button>
		</div>

		{#if showReinstate}
			<div style="margin-top: 16px; padding: 16px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius-lg);">
				<p style="font-size: 14px; font-weight: 600; color: var(--clr-warning); margin-bottom: 8px;">Account Deleted</p>
				<p class="text-muted" style="font-size: 12px; margin-bottom: 12px; line-height: 1.6;">Your account was previously deleted. Your data has been kept for 6 months. You can reinstate your account now to regain full access.</p>
				{#if reinstateMsg}<div style="padding: 10px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 12px; margin-bottom: 12px;">{reinstateMsg}</div>{/if}
				<button class="btn btn-gold" style="width: 100%;" disabled={reinstateLoading} onclick={handleReinstate}>
					{#if reinstateLoading}Reinstating...{:else}Reinstate My Account{/if}
				</button>
				<button class="toggle-link" style="display: block; text-align: center; margin-top: 8px; font-size: 11px; color: var(--clr-text-muted);" onclick={() => { showReinstate = false; authError = ''; }}>Cancel</button>
			</div>
		{/if}

		{#if showVerifyPrompt}
			<div style="margin-top: 16px; padding: 20px; background: rgba(245,166,35,0.06); border: 1px solid rgba(245,166,35,0.15); border-radius: var(--radius-lg); text-align: center;">
				<div style="font-size: 28px; margin-bottom: 8px;">📧</div>
				<div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Verify your email</div>
				<div style="font-size: 13px; color: var(--clr-text-secondary); margin-bottom: 14px; line-height: 1.6;">
					We sent a verification link to <strong style="color: var(--clr-text-primary);">{verifyPromptEmail}</strong>.<br/>Check your inbox (and spam folder) and click the link to activate your account.
				</div>
				<button class="btn btn-gold" style="width: 100%;" disabled={resendLoading} onclick={async () => {
					resendLoading = true;
					verifyMsg = '';
					verifyError = '';
					try {
						const res = await api.resendVerificationByEmail(verifyPromptEmail);
						verifyMsg = res.message || 'Verification email sent! Check your inbox.';
					} catch (err) {
						verifyError = err instanceof Error ? err.message : 'Failed to resend. Try again later.';
					}
					resendLoading = false;
				}}>
					{#if resendLoading}<span class="spinner spinner-sm"></span> Sending...{:else}Resend Verification Email{/if}
				</button>
				{#if verifyMsg}<div class="msg-success" style="margin-top: 10px;">{verifyMsg}</div>{/if}
				{#if verifyError}<div class="msg-error" style="margin-top: 10px;">{verifyError}</div>{/if}
				<button style="margin-top: 12px; background: none; border: none; color: var(--clr-text-muted); font-size: 12px; cursor: pointer; font-family: inherit;" onclick={() => { showVerifyPrompt = false; }}>← Back to login</button>
			</div>
		{/if}

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
	{/if}
	{/if}

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
					<div class="avatar-overlay"><Camera size={14} strokeWidth={2} /></div>
				</div>
				<input type="file" id="avatar-upload" accept="image/png,image/jpeg,image/webp" style="display: none;" onchange={async (e) => {
					const file = (e.target as HTMLInputElement).files?.[0];
					if (!file) return;
					if (file.size > 2 * 1024 * 1024) {
						profileMsg = 'Image must be under 2MB';
						return;
					}
					try {
						// Try media avatar endpoint first, fallback to legacy
						let url = '';
						try {
							const mres = await api.uploadMediaAvatar(file);
							url = mres.url;
						} catch {
							const res = await api.uploadAvatar(file);
							url = res.avatar_url;
						}
						avatarUrl = url;
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
								<span class="sidebar-icon"><svelte:component this={tab.icon} size={16} strokeWidth={1.8} /></span>
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

		{#if profileError}
			<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" style="margin-bottom: 16px;">{profileError}</div>
		{/if}

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
						<div class="big-action-icon"><Search size={28} strokeWidth={1.8} /></div>
						<div class="big-action-text">
							<h3>New Scan</h3>
							<p>Get a complete website audit — scores, issues, and fixes.</p>
						</div>
					</a>
					<a href="/compare" class="big-action-card action-compare">
						<div class="big-action-icon"><Scale size={28} strokeWidth={1.8} /></div>
						<div class="big-action-text">
							<h3>Compare</h3>
							<p>See how two sites stack up across all categories.</p>
						</div>
					</a>
					<a href="/seo" class="big-action-card action-seo">
						<div class="big-action-icon"><Target size={28} strokeWidth={1.8} /></div>
						<div class="big-action-text">
							<h3>SEO Tools</h3>
							<p>Keywords, backlinks, Search Console, and more.</p>
						</div>
					</a>
					<a href="/team" class="big-action-card action-team">
						<div class="big-action-icon"><Users size={28} strokeWidth={1.8} /></div>
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
							<Gift size={22} strokeWidth={1.8} color="var(--clr-gold)" />
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
							<span><ClipboardList size={16} strokeWidth={1.8} /></span>
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
						<span><User size={16} strokeWidth={1.8} /></span>
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

				<!-- ── Plan Status Card ─────────────────── -->
				<div class="card billing-hero" style="margin-bottom: 20px;">
					<div class="card-body">
						<div class="billing-hero-row">
							<div class="billing-hero-left">
								<div class="billing-plan-icon" class:gift={user.billing_type === 'gift'} class:stripe={user.billing_type === 'stripe'}>
									{#if user.billing_type === 'gift'}<Gift size={16} strokeWidth={1.8} />{:else if user.billing_type === 'stripe'}<CreditCard size={16} strokeWidth={1.8} />{:else}🆓{/if}
								</div>
								<div>
									<div class="billing-plan-name">
										{planLabel} plan
										<span class="billing-type-badge" class:gift={user.billing_type === 'gift'} class:stripe={user.billing_type === 'stripe'} class:free={!isPaid}>
											{#if user.billing_type === 'gift'}Gift{:else if user.billing_type === 'stripe'}Monthly{:else}Free{/if}
										</span>
									</div>
									<div class="billing-plan-desc">
										{#if user.billing_type === 'gift' && user.plan_expires_at}
											{@const daysLeft = Math.max(0, Math.ceil((new Date(user.plan_expires_at).getTime() - Date.now()) / 86400000))}
											{#if daysLeft <= 0}
												<span style="color: var(--clr-danger);">Expired — upgrade to keep your features</span>
											{:else if daysLeft <= 7}
												<span style="color: var(--clr-warning);">Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} — {new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
											{:else}
												Active until {new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
											{/if}
										{:else if user.billing_type === 'gift'}
											Gifted — no expiry date
										{:else if user.billing_type === 'stripe'}
											Your subscription renews automatically via Stripe
										{:else}
											3 scans per month — upgrade for more
										{/if}
									</div>
								</div>
							</div>
							<div class="billing-hero-actions">
								{#if !isPaid}
									<button class="btn btn-gold" onclick={() => ui.openCheckout('pro')}>Upgrade to Pro — £9/mo</button>
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Go Agency — £29/mo</button>
								{:else if user.billing_type === 'gift'}
									<button class="btn btn-gold" onclick={() => ui.openCheckout('pro')}>Subscribe Pro — £9/mo</button>
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Subscribe Agency — £29/mo</button>
								{:else if plan === 'pro'}
									<button class="btn btn-blue" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency</button>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- ── Gift Expiry Warning ──────────────── -->
				{#if user.billing_type === 'gift' && user.plan_expires_at}
					{@const daysLeft = Math.max(0, Math.ceil((new Date(user.plan_expires_at).getTime() - Date.now()) / 86400000))}
					{#if daysLeft <= 14}
						<div class="billing-warning" class:expired={daysLeft <= 0}>
							<div class="billing-warning-icon">{daysLeft <= 0 ? '⚠️' : '⏳'}</div>
							<div class="billing-warning-content">
								<div class="billing-warning-title">
									{#if daysLeft <= 0}Your gift plan has expired{:else}Your gift plan expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}{/if}
								</div>
								<div class="billing-warning-sub">
									{#if daysLeft <= 0}
										Upgrade now to keep PDF reports, scan history, compare tool, and all {planLabel} features.
									{:else}
										Switch to a paid plan before it expires to keep all your features without interruption.
									{/if}
								</div>
							</div>
							<button class="btn btn-gold btn-sm" onclick={() => { const el = document.querySelector('.plan-compare'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>
								{daysLeft <= 0 ? 'Choose a Plan' : 'View Plans'}
							</button>
						</div>
					{/if}
				{/if}

				<!-- ── Payment & Invoices (Stripe users) ── -->
				{#if user.billing_type === 'stripe'}
					<div class="card" style="margin-bottom: 20px;">
						<div class="card-header">
							<span><CreditCard size={16} strokeWidth={1.8} /></span>
							<span style="font-weight: 700; font-size: 14px;">Payment & Invoices</span>
						</div>
						<div class="card-body">
							<div class="billing-portal-row">
								<div>
									<div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Manage via Stripe</div>
									<div class="text-muted" style="font-size: 12px; line-height: 1.6;">
										View invoices, update your payment method, change your plan, or download receipts through Stripe's secure billing portal.
									</div>
								</div>
								<button class="btn btn-outline" disabled={portalLoading} onclick={openBillingPortal}>
									{#if portalLoading}<span class="spinner spinner-sm"></span>{/if} Open Billing Portal →
								</button>
							</div>
							{#if billingError}<div class="msg-error">{billingError}</div>{/if}
						</div>
					</div>

					<!-- Cancellation -->
					<div class="card" style="margin-bottom: 20px;">
						<div class="card-header">
							<span>🚫</span>
							<span style="font-weight: 700; font-size: 14px;">Cancellation</span>
						</div>
						<div class="card-body">
							<div class="billing-portal-row">
								<div class="text-muted" style="font-size: 12px; line-height: 1.6;">
									Cancel your plan anytime through Stripe. You'll keep access until the end of your current billing period.
								</div>
								<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3);" disabled={portalLoading} onclick={openBillingPortal}>
									{#if portalLoading}<span class="spinner spinner-sm"></span>{/if} Cancel Plan
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- ── Gift Plan Info ───────────────────── -->
				{#if user.billing_type === 'gift'}
					<div class="card" style="margin-bottom: 20px;">
						<div class="card-header">
							<span><Gift size={16} strokeWidth={1.8} /></span>
							<span style="font-weight: 700; font-size: 14px;">Gift Plan Details</span>
						</div>
						<div class="card-body">
							<div class="billing-detail-grid">
								<div class="billing-detail">
									<div class="billing-detail-label">Plan</div>
									<div class="billing-detail-value">{planLabel}</div>
								</div>
								<div class="billing-detail">
									<div class="billing-detail-label">Type</div>
									<div class="billing-detail-value" style="color: var(--clr-gold);">Gift</div>
								</div>
								<div class="billing-detail">
									<div class="billing-detail-label">Expires</div>
									<div class="billing-detail-value">
										{#if user.plan_expires_at}
											{new Date(user.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
										{:else}
											Never
										{/if}
									</div>
								</div>
								<div class="billing-detail">
									<div class="billing-detail-label">Cost</div>
									<div class="billing-detail-value">£0.00</div>
								</div>
							</div>
							<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--clr-border); font-size: 12px; color: var(--clr-text-muted); line-height: 1.6;">
								{#if user.plan_expires_at}
									When your gift expires, your account will revert to the Free plan. Subscribe before then to keep all your features.
								{:else}
									Your gift plan has no expiry — enjoy full {planLabel} features indefinitely. You can switch to a paid plan at any time if you'd like to support BSCAN.
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- ── Plan Comparison ──────────────────── -->
				<div class="plan-compare">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="compare-col" class:active-plan={!isPaid} class:clickable={isPaid} onclick={() => { /* Free = no checkout */ }}>
						<div class="compare-header free">Free</div>
						<div class="compare-feat">3 scans/month</div>
						<div class="compare-feat">Basic audit</div>
						<div class="compare-feat dim">No PDF export</div>
						<div class="compare-feat dim">No scan history</div>
						<div class="compare-feat dim">No compare tool</div>
						{#if !isPaid}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-success); font-weight: 700;">✓ Your current plan</div>
						{:else}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-text-muted);">Current features exceed this plan</div>
						{/if}
					</div>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="compare-col" class:featured={!isPaid || plan === 'pro'} class:active-plan={plan === 'pro'} class:clickable={plan !== 'pro'} onclick={() => { if (plan !== 'pro') ui.openCheckout('pro'); }}>
						<div class="compare-header pro">Pro · £9/mo</div>
						<div class="compare-feat">30 scans/month</div>
						<div class="compare-feat">Core Web Vitals</div>
						<div class="compare-feat">PDF reports</div>
						<div class="compare-feat">Scan history</div>
						<div class="compare-feat">Compare tool</div>
						<div class="compare-feat">SEO tools</div>
						{#if plan === 'pro'}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-gold); font-weight: 700;">✓ Your current plan</div>
						{:else}
							<button class="btn btn-gold btn-sm" style="margin-top: 12px; width: 100%;" onclick={(e) => { e.stopPropagation(); ui.openCheckout('pro'); }}>
								{#if plan === 'agency'}Switch to Pro{:else}Upgrade to Pro{/if}
							</button>
						{/if}
					</div>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="compare-col" class:featured={plan === 'agency'} class:active-plan={plan === 'agency'} class:clickable={plan !== 'agency'} onclick={() => { if (plan !== 'agency') ui.openCheckout('agency'); }}>
						<div class="compare-header agency">Agency · £29/mo</div>
						<div class="compare-feat">Unlimited scans</div>
						<div class="compare-feat">5 team members</div>
						<div class="compare-feat">API access</div>
						<div class="compare-feat">White-label PDFs</div>
						<div class="compare-feat">AI SEO strategy</div>
						<div class="compare-feat">Priority support</div>
						{#if plan === 'agency'}
							<div style="margin-top: 12px; font-size: 11px; color: var(--clr-blue); font-weight: 700;">✓ Your current plan</div>
						{:else}
							<button class="btn btn-blue btn-sm" style="margin-top: 12px; width: 100%;" onclick={(e) => { e.stopPropagation(); ui.openCheckout('agency'); }}>Upgrade to Agency</button>
						{/if}
					</div>
				</div>

				<!-- ── Promo Code ───────────────────────── -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>🎟️</span>
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
						<span><ShieldCheck size={16} strokeWidth={1.8} /></span>
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
											<button class="btn btn-ghost btn-sm" onclick={() => ui.showPaywall('PDF Export', 'Download professional audit reports. Upgrade to Pro to unlock.')}><ShieldCheck size={12} strokeWidth={2} /> PDF</button>
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
						<span><Key size={16} strokeWidth={1.8} /></span>
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

		<!-- ── API USAGE TAB ───────────────────── -->
		{#if activeTab === 'api-usage'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">API Usage</h3>

				{#if apiUsageLoading}
					<div style="padding: 48px; text-align: center;"><span class="spinner"></span></div>
				{:else if !apiUsage}
					<div style="text-align: center; padding: 24px;">
						<button class="btn btn-gold" onclick={loadApiUsage}>Load Usage Data</button>
					</div>
				{:else}
					<!-- Usage Summary -->
					<div class="api-usage-grid">
						<div class="api-stat"><div class="api-stat-val">{apiUsage.credits_used ?? 0}</div><div class="api-stat-lbl">Credits Used</div></div>
						<div class="api-stat"><div class="api-stat-val">{apiUsage.credits_remaining ?? 0}</div><div class="api-stat-lbl">Remaining</div></div>
						<div class="api-stat"><div class="api-stat-val">{apiUsage.plan || '—'}</div><div class="api-stat-lbl">Plan</div></div>
						<div class="api-stat"><div class="api-stat-val">{apiUsage.days_left ?? '—'}</div><div class="api-stat-lbl">Days Left</div></div>
					</div>

					<!-- Usage History (bar chart) -->
					{#if apiUsageHistory.length > 0}
						<div class="card" style="margin-bottom: 16px;">
							<div class="card-header">
								<span><BarChart3 size={14} strokeWidth={2} /></span>
								<span style="font-weight: 700; font-size: 13px;">Daily Usage (Last 30 Days)</span>
							</div>
							<div class="card-body">
								<div class="api-chart">
									{#each apiUsageHistory as d}
										{@const maxCredits = Math.max(...apiUsageHistory.map((x: any) => x.credits || 0), 1)}
										<div class="api-chart-bar" title="{d.date}: {d.credits} credits">
											<div class="api-chart-fill" style="height: {((d.credits || 0) / maxCredits) * 100}%;"></div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Monthly Breakdown -->
					{#if apiUsageMonthly.length > 0}
						<div class="card" style="margin-bottom: 16px;">
							<div class="card-header">
								<span>📅</span>
								<span style="font-weight: 700; font-size: 13px;">Monthly Breakdown</span>
							</div>
							<div class="card-body" style="padding: 0;">
								{#each apiUsageMonthly as m}
									<div class="api-month-row">
										<span class="api-month-label">{m.month || m.period || '—'}</span>
										<span class="api-month-val">{m.credits ?? m.total ?? 0} credits</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- API Call Logs -->
					{#if apiUsageLogs.length > 0}
						<div class="card">
							<div class="card-header">
								<span>📋</span>
								<span style="font-weight: 700; font-size: 13px;">Recent API Calls</span>
							</div>
							<div class="card-body" style="padding: 0;">
								<div class="api-log-header">
									<span>Endpoint</span>
									<span>Method</span>
									<span>Status</span>
									<span>Credits</span>
									<span>Date</span>
								</div>
								{#each apiUsageLogs as log}
									<div class="api-log-row">
										<span class="api-log-endpoint font-mono">{log.endpoint || log.path || '—'}</span>
										<span class="api-log-method">{log.method || '—'}</span>
										<span class="api-log-status" class:api-ok={log.status < 400} class:api-err={log.status >= 400}>{log.status || '—'}</span>
										<span>{log.credits ?? 0}</span>
										<span class="text-muted">{log.created_at ? new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
									</div>
								{/each}
								<div style="padding: 12px; text-align: center;">
									<button class="btn btn-ghost btn-sm" onclick={loadMoreLogs}>Load More</button>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- ── SECURITY TAB ─────────────────────── -->

		{#if activeTab === 'reports'}
		<!-- ══════ REPORTS ══════ -->
		{#if !isAgency}
		<div class="tab-content animate-fade-up">
			<div style="padding: 48px 24px; text-align: center;">
				<div style="font-size: 48px; margin-bottom: 12px;">📊</div>
				<h3 style="margin: 0 0 8px; font-size: 18px;">Scheduled Client Reports</h3>
				<p class="text-muted" style="max-width: 420px; margin: 0 auto 20px; font-size: 13px;">
					Automatically scan client websites on a schedule and send branded audit reports with AI-powered fix recommendations. Available on the Agency plan.
				</p>
				<button class="btn btn-gold" onclick={() => activeTab = 'billing'}>Upgrade to Agency →</button>
			</div>
		</div>
		{:else}
		<div class="tab-content animate-fade-up" use:reportInit>
			<div class="reports-wrap">

				<!-- Stats -->
				{#if reportStats}
				<div class="rpt-stats">
					<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.active_schedules}</div><div class="rpt-stat-lbl">Active</div></div>
					<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.total_reports_sent}</div><div class="rpt-stat-lbl">Sent</div></div>
					<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.reports_this_month}</div><div class="rpt-stat-lbl">This Month</div></div>
					<div class="rpt-stat"><div class="rpt-stat-val">{reportStats.avg_client_score ?? '—'}</div><div class="rpt-stat-lbl">Avg Score</div></div>
				</div>
				{/if}

				{#if reportMsg}<div style="padding: 12px 16px; border-radius: var(--radius-sm); background: rgba(16,185,129,0.1); color: var(--clr-success); font-size: 13px; margin-bottom: 16px;">{reportMsg}</div>{/if}
				{#if reportError}<div style="padding: 12px 16px; border-radius: var(--radius-sm); background: rgba(239,68,68,0.1); color: var(--clr-danger); font-size: 13px; margin-bottom: 16px;">{reportError} <button style="float:right; background:none; border:none; cursor:pointer; color:inherit;" onclick={() => reportError = ''}>✕</button></div>{/if}

				<!-- Header -->
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
					<h3 class="section-title" style="margin: 0;">Scheduled Reports</h3>
					<button class="btn btn-gold btn-sm" onclick={() => showNewSchedule = !showNewSchedule}>
						{showNewSchedule ? 'Cancel' : '+ New Schedule'}
					</button>
				</div>

				<!-- New Schedule Form -->
				{#if showNewSchedule}
				<div class="card" style="padding: 20px; margin-bottom: 20px; border: 1px solid var(--clr-gold-dim);">
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
						<div><label class="label" for="sched-url">Website URL *</label><input id="sched-url" class="input" type="url" placeholder="https://client-site.com" bind:value={newSched.url} /></div>
						<div><label class="label" for="sched-email">Recipient Email *</label><input id="sched-email" class="input" type="email" placeholder="client@company.com" bind:value={newSched.recipient_email} /></div>
						<div><label class="label" for="sched-name">Recipient Name</label><input id="sched-name" class="input" type="text" placeholder="John Smith" bind:value={newSched.recipient_name} /></div>
						<div><label class="label" for="sched-freq">Frequency</label><select id="sched-freq" class="input" bind:value={newSched.frequency}><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option></select></div>
						<div><label class="label" for="sched-brand">Brand Name</label><input id="sched-brand" class="input" type="text" placeholder="Your Company" bind:value={newSched.branding_company} /></div>
						<div><label class="label" for="sched-color-text">Brand Colour</label><div style="display: flex; gap: 8px; align-items: center;"><input type="color" bind:value={newSched.branding_color} style="width: 40px; height: 36px; border: none; cursor: pointer; border-radius: 6px;" aria-label="Brand colour picker" /><input id="sched-color-text" class="input" type="text" bind:value={newSched.branding_color} style="flex: 1; font-family: var(--font-mono);" /></div></div>
					</div>
					<div style="display: flex; gap: 16px; margin-top: 16px; align-items: center;">
						<label style="font-size: 12px; display: flex; align-items: center; gap: 6px;"><input type="checkbox" bind:checked={newSched.include_ai_fixes} /> AI Fixes</label>
						<label style="font-size: 12px; display: flex; align-items: center; gap: 6px;"><input type="checkbox" bind:checked={newSched.include_comparison} /> Score Comparison</label>
						<div style="margin-left: auto;"><button class="btn btn-gold" onclick={createScheduleReport} disabled={reportSaving}>{reportSaving ? 'Creating...' : 'Create Schedule'}</button></div>
					</div>
				</div>
				{/if}

				<!-- Schedule Cards -->
				{#if reportSchedules.length === 0 && !reportLoading}
					<div style="padding: 48px; text-align: center; background: var(--clr-bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--clr-border);">
						<div style="font-size: 36px; margin-bottom: 8px;">📊</div>
						<p style="font-size: 14px; color: var(--clr-text-muted); max-width: 320px; margin: 0 auto;">No scheduled reports yet. Add your first client site to start sending automated reports.</p>
					</div>
				{:else}
					{#each reportSchedules as s}
					<div class="rpt-card" class:rpt-paused={s.status === 'paused'}>
						<div class="rpt-card-top">
							<div style="flex: 1; min-width: 0;">
								<div class="rpt-url">{s.url.replace('https://', '')}</div>
								<div class="rpt-recip">{s.recipient_name || s.recipient_email} · {s.frequency}{s.branding_company ? ' · ' + s.branding_company : ''}</div>
							</div>
							<div class="rpt-score" style="color: {s.last_score >= 80 ? 'var(--clr-success)' : s.last_score >= 60 ? 'var(--clr-blue)' : s.last_score ? 'var(--clr-warning)' : 'var(--clr-text-muted)'};">{s.last_score ?? '—'}</div>
						</div>
						<div class="rpt-card-btm">
							<div class="rpt-info">
								<span class="rpt-badge" class:rpt-active={s.status === 'active'} class:rpt-paused-badge={s.status === 'paused'}>{s.status}</span>
								<span class="text-muted" style="font-size: 11px;">Sent {s.total_sent}x</span>
								{#if s.next_run_at}<span class="text-muted" style="font-size: 11px;">Next: {new Date(s.next_run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>{/if}
							</div>
							<div style="display: flex; gap: 6px;">
								<button class="btn btn-ghost btn-sm" onclick={() => loadReportHistory(s.id)}>{rptHistoryOpen === s.id ? 'Hide History' : 'History'}</button>
								<button class="btn btn-ghost btn-sm" onclick={() => sendReportNow(s.id)} disabled={sendingNow === s.id}>{sendingNow === s.id ? '...' : 'Send Now'}</button>
								<button class="btn btn-ghost btn-sm" onclick={() => toggleSched(s.id, s.status)}>{s.status === 'active' ? 'Pause' : 'Resume'}</button>
								<button class="btn btn-ghost btn-sm" style="color: var(--clr-danger);" onclick={() => deleteSched(s.id)}>Delete</button>
							</div>
						</div>
						{#if rptHistoryOpen === s.id}
							<div class="rpt-history">
								{#if rptHistoryLoading === s.id}
									<p class="text-muted" style="font-size: 12px; padding: 12px;">Loading history...</p>
								{:else if (rptHistoryData[s.id] || []).length === 0}
									<p class="text-muted" style="font-size: 12px; padding: 12px;">No delivery history yet.</p>
								{:else}
									{#each rptHistoryData[s.id] as h}
										<div class="rpt-hist-row">
											<span class="rpt-hist-date">{new Date(h.sent_at || h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
											<span class="rpt-hist-recip">{h.recipient || h.recipient_email || '—'}</span>
											<span class="rpt-hist-status" class:rpt-delivered={h.status === 'delivered'} class:rpt-failed={h.status === 'failed' || h.status === 'bounced'}>{h.status}</span>
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
					{/each}
				{/if}
			</div>
		</div>
		{/if}

				{/if}

{#if activeTab === 'branding'}
			<div class="tab-content animate-fade-up">
				<h3 style="margin-bottom: 20px;">White-Label Branding</h3>
				{#if !isAgency}
					<div class="card">
						<div class="card-body" style="text-align: center; padding: 40px;">
							<div style="margin-bottom: 12px;"><Palette size={48} strokeWidth={1.2} color="var(--clr-gold)" /></div>
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

				<!-- Notification Preferences -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F514;</span>
						<span style="font-weight: 700; font-size: 14px;">Notification Preferences</span>
						{#if notifPrefsMsg}<span style="margin-left: auto; font-size: 11px; color: var(--clr-success);">{notifPrefsMsg}</span>{/if}
					</div>
					<div class="card-body">
						{#if notifPrefsLoading}
							<p class="text-muted" style="font-size: 12px;">Loading preferences...</p>
						{:else}
							<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Choose which notifications you receive.</p>
							{#each [
								{ key: 'likes', label: 'Likes', desc: 'When someone likes your post' },
								{ key: 'comments', label: 'Comments', desc: 'When someone comments on your post' },
								{ key: 'follows', label: 'Follows', desc: 'When someone follows you' },
								{ key: 'dms', label: 'Messages', desc: 'Direct message notifications' },
								{ key: 'mentions', label: 'Mentions', desc: 'When someone mentions you' },
								{ key: 'community', label: 'Community', desc: 'Community updates and announcements' },
								{ key: 'digest', label: 'Weekly Digest', desc: 'Weekly summary email' },
							] as item}
								<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--clr-border);">
									<div>
										<p style="font-size: 13px; font-weight: 600;">{item.label}</p>
										<p class="text-muted" style="font-size: 11px;">{item.desc}</p>
									</div>
									<button class="push-toggle" class:active={notifPrefs[item.key]} disabled={notifPrefsSaving} onclick={() => toggleNotifPref(item.key)} aria-label="Toggle {item.label}">
										<span class="push-toggle-knob"></span>
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Change Password -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span><ShieldCheck size={16} strokeWidth={1.8} /></span>
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

				<!-- Change Email -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x2709;</span>
						<span style="font-weight: 700; font-size: 14px;">Change Email</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">A 6-digit code will be sent to your new email to verify the change.</p>
						{#if !ceCodeSent}
							<div class="field">
								<label class="label" for="ce-email">New Email Address</label>
								<input class="input" type="email" id="ce-email" placeholder="newemail@example.com" bind:value={ceNewEmail} />
							</div>
							<div class="field" style="margin-top: 12px;">
								<label class="label" for="ce-pw">Current Password</label>
								<input class="input" type="password" id="ce-pw" bind:value={cePassword} />
							</div>
							{#if ceError}<div class="msg-error" style="margin-top: 8px;">{ceError}</div>{/if}
							{#if ceMsg}<div class="msg-success" style="margin-top: 8px;">{ceMsg}</div>{/if}
							<button class="btn btn-gold" style="margin-top: 16px;" disabled={ceLoading || !ceNewEmail || !cePassword} onclick={handleChangeEmail}>
								{ceLoading ? 'Sending code...' : 'Send Verification Code'}
							</button>
						{:else}
							<p style="font-size: 13px; margin-bottom: 12px;">Enter the 6-digit code sent to <strong>{ceNewEmail}</strong></p>
							<div class="field">
								<input class="input" type="text" inputmode="numeric" maxlength="6" placeholder="000000" bind:value={ceCode} style="text-align: center; letter-spacing: 4px; font-family: monospace; font-size: 18px;" />
							</div>
							{#if ceError}<div class="msg-error" style="margin-top: 8px;">{ceError}</div>{/if}
							{#if ceMsg}<div class="msg-success" style="margin-top: 8px;">{ceMsg}</div>{/if}
							<div style="display: flex; gap: 8px; margin-top: 12px;">
								<button class="btn btn-gold" disabled={ceVerifyLoading || ceCode.length !== 6} onclick={handleVerifyEmailChange}>
									{ceVerifyLoading ? 'Verifying...' : 'Verify & Update Email'}
								</button>
								<button class="btn btn-outline btn-sm" onclick={() => { ceCodeSent = false; ceCode = ''; ceError = ''; ceMsg = ''; }}>Cancel</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Two-Factor Authentication -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span><Key size={16} strokeWidth={1.8} /></span>
						<span style="font-weight: 700; font-size: 14px;">Two-Factor Authentication</span>
					</div>
					<div class="card-body">
						{#if twoFaMsg}<div class="msg-success" style="margin-bottom: 12px; font-size: 12px;">{twoFaMsg}</div>{/if}
						{#if twoFaError}<div class="msg-error" style="margin-bottom: 12px; font-size: 12px;">{twoFaError}</div>{/if}
						{#if twoFaBackupCodes.length > 0}
							<div style="padding: 12px; background: rgba(245,166,35,0.08); border: 1px solid rgba(245,166,35,0.2); border-radius: var(--radius-md); margin-bottom: 12px;">
								<p style="font-size: 12px; font-weight: 700; margin-bottom: 8px;">Save your backup codes:</p>
								<div style="font-family: monospace; font-size: 13px; line-height: 1.8;">{#each twoFaBackupCodes as code}<div>{code}</div>{/each}</div>
								<p class="text-muted" style="font-size: 11px; margin-top: 8px;">Store these in a safe place. Each code can only be used once.</p>
							</div>
						{/if}
						{#if !twoFaEnabled}
							{#if twoFaSetupData}
								<p class="text-muted" style="font-size: 12px; margin-bottom: 10px;">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
								<div style="text-align: center; margin-bottom: 12px;">
									<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(twoFaSetupData.provisioning_uri)}" alt="2FA QR Code" style="border-radius: 8px; border: 1px solid var(--clr-border);" width="200" height="200" />
								</div>
								<p class="text-muted" style="font-size: 11px; margin-bottom: 10px;">Or enter manually: <code style="background: var(--clr-bg-secondary); padding: 2px 6px; border-radius: 4px; font-size: 12px;">{twoFaSetupData.secret}</code></p>
								<div class="field">
									<label class="label" for="2fa-code">Enter 6-digit code from app</label>
									<input class="input" id="2fa-code" type="text" inputmode="numeric" maxlength="6" placeholder="000000" bind:value={twoFaCode} style="text-align: center; letter-spacing: 4px; font-family: monospace; font-size: 18px;" />
								</div>
								<button class="btn btn-gold" style="margin-top: 12px;" disabled={twoFaLoading || twoFaCode.length !== 6} onclick={handle2faVerify}>
									{#if twoFaLoading}Verifying...{:else}Enable 2FA{/if}
								</button>
							{:else}
								<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Add an extra layer of security to your account by enabling two-factor authentication.</p>
								<button class="btn btn-outline btn-sm" disabled={twoFaLoading} onclick={handle2faSetup}>
									{#if twoFaLoading}Setting up...{:else}Enable 2FA{/if}
								</button>
							{/if}
						{:else}
							<p style="font-size: 13px; font-weight: 600; color: var(--clr-success); margin-bottom: 12px;">&#x2713; 2FA is enabled</p>
							<div class="field" style="margin-bottom: 8px;">
								<label class="label" for="2fa-disable-code">Authenticator code</label>
								<input class="input" id="2fa-disable-code" type="text" inputmode="numeric" maxlength="6" placeholder="000000" bind:value={twoFaDisableCode} />
							</div>
							<div class="field" style="margin-bottom: 12px;">
								<label class="label" for="2fa-disable-pw">Password</label>
								<input class="input" id="2fa-disable-pw" type="password" bind:value={twoFaDisablePassword} />
							</div>
							<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3);" disabled={twoFaLoading} onclick={handle2faDisable}>Disable 2FA</button>
						{/if}
					</div>
				</div>

				<!-- Passkey Registration -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F511;</span>
						<span style="font-weight: 700; font-size: 14px;">Passkeys</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">Sign in with your fingerprint, face, or device PIN. Passkeys are more secure than passwords.</p>
						{#if passkeyRegMsg}<div class="msg-success" style="margin-bottom: 12px; font-size: 12px;">{passkeyRegMsg}</div>{/if}
						{#if passkeyRegError}<div class="msg-error" style="margin-bottom: 12px; font-size: 12px;">{passkeyRegError}</div>{/if}
						<button class="btn btn-outline btn-sm" disabled={passkeyRegLoading} onclick={handlePasskeyRegister}>
							{#if passkeyRegLoading}Registering...{:else}Add Passkey{/if}
						</button>
					</div>
				</div>

				<!-- Blocked Users -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F6AB;</span>
						<span style="font-weight: 700; font-size: 14px;">Blocked Users</span>
					</div>
					<div class="card-body">
						{#if blockedLoading}
							<p class="text-muted" style="font-size: 12px;">Loading...</p>
						{:else if blockedUsers.length === 0}
							<p class="text-muted" style="font-size: 12px;">No blocked users</p>
						{:else}
							{#each blockedUsers as u}
								<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--clr-border);">
									<div style="display: flex; align-items: center; gap: 10px;">
										<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--clr-bg-secondary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">{(u.display_name || u.username || '?')[0].toUpperCase()}</div>
										<div>
											<p style="font-size: 13px; font-weight: 600;">@{u.username}</p>
											{#if u.display_name}<p class="text-muted" style="font-size: 11px;">{u.display_name}</p>{/if}
										</div>
									</div>
									<button class="btn btn-outline btn-sm" onclick={() => handleUnblock(u.username)}>Unblock</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Muted Users -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F507;</span>
						<span style="font-weight: 700; font-size: 14px;">Muted Users</span>
					</div>
					<div class="card-body">
						{#if mutedLoading}
							<p class="text-muted" style="font-size: 12px;">Loading...</p>
						{:else if mutedUsers.length === 0}
							<p class="text-muted" style="font-size: 12px;">No muted users</p>
						{:else}
							{#each mutedUsers as u}
								<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--clr-border);">
									<div style="display: flex; align-items: center; gap: 10px;">
										<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--clr-bg-secondary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">{(u.display_name || u.username || '?')[0].toUpperCase()}</div>
										<div>
											<p style="font-size: 13px; font-weight: 600;">@{u.username}</p>
											{#if u.display_name}<p class="text-muted" style="font-size: 11px;">{u.display_name}</p>{/if}
										</div>
									</div>
									<button class="btn btn-outline btn-sm" onclick={() => handleUnmute(u.username)}>Unmute</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Active Sessions -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>🛡️</span>
						<span style="font-weight: 700; font-size: 14px;">Active Sessions</span>
					</div>
					<div class="card-body">
						{#if sessionsLoading}
							<p class="text-muted" style="font-size: 12px;">Loading sessions...</p>
						{:else if sessions.length === 0}
							<p class="text-muted" style="font-size: 12px;">No active sessions found.</p>
						{:else}
							<div style="margin-bottom: 12px;">
								{#each sessions as s}
									<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--clr-border);">
										<div style="min-width: 0; flex: 1;">
											<p style="font-size: 13px; font-weight: 600;">{s.device_info || 'Unknown device'}</p>
											<p class="text-muted" style="font-size: 11px;">{s.ip_address || '—'} &middot; Created {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
										</div>
										<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3); flex-shrink: 0;" disabled={revokeLoadingId === s.id} onclick={() => handleRevokeSession(s.id)}>
											{revokeLoadingId === s.id ? '...' : 'Revoke'}
										</button>
									</div>
								{/each}
							</div>
						{/if}
						<div style="display: flex; gap: 8px; margin-top: 12px;">
							<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3);" onclick={() => { auth.logout(); window.location.href = '/account'; }}>Sign Out</button>
							<button class="btn btn-outline btn-sm" onclick={handleLogoutAll}>Sign Out All Devices</button>
						</div>
					</div>
				</div>

				<!-- Login History -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F4CB;</span>
						<span style="font-weight: 700; font-size: 14px;">Login History</span>
					</div>
					<div class="card-body">
						{#if loginHistoryLoading}
							<p class="text-muted" style="font-size: 12px;">Loading history...</p>
						{:else if loginHistory.length === 0}
							<p class="text-muted" style="font-size: 12px;">No login history available.</p>
						{:else}
							<div style="max-height: 300px; overflow-y: auto;">
								{#each loginHistory as h}
									<div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--clr-border);">
										<div style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: {h.status === 'success' ? 'var(--clr-success)' : 'var(--clr-danger)'};">
										</div>
										<div style="min-width: 0; flex: 1;">
											<p style="font-size: 12px; font-weight: 500;">{h.ip || '—'}</p>
											<p class="text-muted" style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{h.user_agent || '—'}</p>
										</div>
										<div style="text-align: right; flex-shrink: 0;">
											<p style="font-size: 11px; font-weight: 600; color: {h.status === 'success' ? 'var(--clr-success)' : 'var(--clr-danger)'};">{h.status}</p>
											<p class="text-muted" style="font-size: 10px;">{new Date(h.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- E2E Key Backup -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F512;</span>
						<span style="font-weight: 700; font-size: 14px;">Message Encryption Key</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; margin-bottom: 12px; line-height: 1.6;">
							Your messages are end-to-end encrypted. Back up your key to restore encrypted messages on a new device.
							{#if e2eHasKey}<span style="color: var(--clr-success); font-weight: 600;"> Key active on this device.</span>{:else}<span style="color: var(--clr-danger); font-weight: 600;"> No key on this device.</span>{/if}
						</p>
						{#if e2eHasKey}
							<div style="margin-bottom: 12px;">
								<label class="label" for="e2e-backup-pw" style="font-size: 11px; margin-bottom: 4px;">Backup passphrase (min 8 chars)</label>
								<input class="input" type="password" id="e2e-backup-pw" placeholder="Enter a strong passphrase..." bind:value={e2eBackupPassphrase} />
							</div>
							{#if e2eBackupError}<div class="msg-error" style="margin-bottom: 8px;">{e2eBackupError}</div>{/if}
							{#if e2eBackupMsg}<div class="msg-success" style="margin-bottom: 8px;">{e2eBackupMsg}</div>{/if}
							<div style="display: flex; gap: 8px;">
								<button class="btn btn-gold btn-sm" disabled={e2eBackupLoading} onclick={backupE2EKey}>
									{#if e2eBackupLoading}Backing up...{:else}Backup Key{/if}
								</button>
								{#if e2eHasBackup}
									<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3);" onclick={deleteE2EBackup}>Delete Backup</button>
								{/if}
							</div>
						{:else}
							<div style="margin-bottom: 12px;">
								<label class="label" for="e2e-restore-pw" style="font-size: 11px; margin-bottom: 4px;">Backup passphrase</label>
								<input class="input" type="password" id="e2e-restore-pw" placeholder="Enter your backup passphrase..." bind:value={e2eRestorePassphrase} />
							</div>
							{#if e2eRestoreError}<div class="msg-error" style="margin-bottom: 8px;">{e2eRestoreError}</div>{/if}
							{#if e2eRestoreMsg}<div class="msg-success" style="margin-bottom: 8px;">{e2eRestoreMsg}</div>{/if}
							<button class="btn btn-gold btn-sm" disabled={e2eRestoreLoading} onclick={restoreE2EKey}>
								{#if e2eRestoreLoading}Restoring...{:else}Restore Key from Backup{/if}
							</button>
						{/if}
					</div>
				</div>

				<!-- Content Appeals -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x2696;</span>
						<span style="font-weight: 700; font-size: 14px;">Content Appeals</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; margin-bottom: 12px;">If content was removed by moderation, you can appeal here. Under the UK Online Safety Act, you have the right to appeal content decisions.</p>
						{#if appealsLoading}
							<p class="text-muted" style="font-size: 12px;">Loading appeals...</p>
						{:else if appeals.length === 0}
							<p class="text-muted" style="font-size: 12px;">No appeals submitted.</p>
						{:else}
							<div style="max-height: 250px; overflow-y: auto;">
								{#each appeals as a}
									<div style="padding: 10px 0; border-bottom: 1px solid var(--clr-border);">
										<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
											<span style="font-size: 12px; font-weight: 600;">{a.content_type} #{a.content_id}</span>
											<span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
												background: {a.status === 'pending' ? 'rgba(245,166,35,0.1)' : a.status === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};
												color: {a.status === 'pending' ? 'var(--clr-warning)' : a.status === 'approved' ? 'var(--clr-success)' : 'var(--clr-danger)'};">
												{a.status}
											</span>
										</div>
										<p class="text-muted" style="font-size: 11px; line-height: 1.5;">{a.reason}</p>
										{#if a.admin_notes}<p style="font-size: 11px; color: var(--clr-text-secondary); margin-top: 4px;">Admin: {a.admin_notes}</p>{/if}
										<p class="text-muted" style="font-size: 10px; margin-top: 4px;">{new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- GDPR — Your Data -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F4E6;</span>
						<span style="font-weight: 700; font-size: 14px;">Your Data</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; line-height: 1.6; margin-bottom: 12px;">Download a copy of all your data or request account deletion. Under UK GDPR and EU GDPR, you have the right to access, port, and erase your personal data.</p>
						<button class="btn btn-outline btn-sm" disabled={gdprExportLoading} onclick={handleGdprExport}>
							{#if gdprExportLoading}Generating...{:else}Download My Data{/if}
						</button>
						{#if gdprExportMsg}<p style="font-size: 12px; margin-top: 8px; color: var(--clr-success);">{gdprExportMsg}</p>{/if}

						<!-- Consent Status -->
						<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--clr-border);">
							<p style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Consent Status</p>
							{#if consentsLoading}
								<p class="text-muted" style="font-size: 12px;">Loading...</p>
							{:else}
								{#each consents as c}
									<div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--clr-border);">
										<div>
											<p style="font-size: 12px; font-weight: 500; text-transform: capitalize;">{c.consent_type}</p>
											{#if c.note}<p class="text-muted" style="font-size: 10px;">{c.note}</p>{/if}
										</div>
										<span style="font-size: 11px; font-weight: 600; color: {c.granted ? 'var(--clr-success)' : 'var(--clr-text-muted)'};">
											{c.granted ? 'Granted' : 'Not granted'}
										</span>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>

				<!-- ID Verification -->
				<div class="card" style="margin-top: 20px;">
					<div class="card-header">
						<span>&#x1F4CB;</span>
						<span style="font-weight: 700; font-size: 14px;">Identity Verification</span>
					</div>
					<div class="card-body">
						{#if idVerifLoading}
							<p class="text-muted" style="font-size: 12px;">Loading...</p>
						{:else if idVerifStatus?.status === 'verified'}
							<div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(16,185,129,0.08); border-radius: 8px; border: 1px solid rgba(16,185,129,0.2);">
								<span style="font-size: 18px;">&#x2705;</span>
								<div>
									<p style="font-size: 13px; font-weight: 600; color: var(--clr-success);">Identity Verified</p>
									<p class="text-muted" style="font-size: 11px;">Your identity has been confirmed</p>
								</div>
							</div>
						{:else if idVerifStatus?.status === 'pending'}
							<div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(245,166,35,0.08); border-radius: 8px; border: 1px solid rgba(245,166,35,0.2);">
								<span style="font-size: 18px;">&#x23F3;</span>
								<div>
									<p style="font-size: 13px; font-weight: 600; color: var(--clr-warning);">Verification Pending</p>
									<p class="text-muted" style="font-size: 11px;">Your submission is being reviewed</p>
								</div>
							</div>
						{:else}
							<p class="text-muted" style="font-size: 12px; line-height: 1.6; margin-bottom: 12px;">Verify your identity to unlock trust badges and higher limits. Upload a government-issued ID.</p>
							{#if idVerifError}<div class="msg-error" style="margin-bottom: 8px; font-size: 12px;">{idVerifError}</div>{/if}
							{#if idVerifMsg}<div class="msg-success" style="margin-bottom: 8px; font-size: 12px;">{idVerifMsg}</div>{/if}
							<div style="display: flex; flex-direction: column; gap: 10px;">
								<input class="input" type="text" placeholder="Full legal name" bind:value={idVerifFullName} />
								<select class="input" bind:value={idVerifDocType}>
									<option value="passport">Passport</option>
									<option value="driving_license">Driving License</option>
									<option value="national_id">National ID Card</option>
								</select>
								<input class="input" type="url" placeholder="Document image URL (upload to R2 first)" bind:value={idVerifDocUrl} />
								<button class="btn btn-primary btn-sm" disabled={idVerifSubmitting} onclick={submitIdVerification}>
									{idVerifSubmitting ? 'Submitting...' : 'Submit Verification'}
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Deactivate Account -->
				<div class="card" style="margin-top: 20px; border-color: rgba(245,166,35,0.2);">
					<div class="card-header">
						<span>&#x23F8;</span>
						<span style="font-weight: 700; font-size: 14px;">Deactivate Account</span>
					</div>
					<div class="card-body">
						<p class="text-muted" style="font-size: 12px; line-height: 1.6; margin-bottom: 12px;">Temporarily hide your profile and posts. Your data is preserved and you can reactivate any time by logging in again.</p>
						{#if deactivateMsg}<div class="msg-success" style="margin-bottom: 12px; font-size: 12px;">{deactivateMsg}</div>{/if}
						<button class="btn btn-outline btn-sm" style="color: var(--clr-warning); border-color: rgba(245,166,35,0.3);" disabled={deactivateLoading} onclick={handleDeactivate}>
							{deactivateLoading ? 'Deactivating...' : 'Deactivate Account'}
						</button>
					</div>
				</div>

				<!-- Danger Zone -->
				<div class="card" style="margin-top: 20px; border-color: rgba(239,68,68,0.2);">
					<div class="card-header">
						<span>&#x26A0;&#xFE0F;</span>
						<span style="font-weight: 700; font-size: 14px; color: var(--clr-danger);">Danger Zone</span>
					</div>
					<div class="card-body">
						{#if gdprDeletionPending}
							<div style="padding: 16px; background: rgba(245,166,35,0.08); border: 1px solid rgba(245,166,35,0.2); border-radius: var(--radius-md); margin-bottom: 12px;">
								<p style="font-size: 13px; font-weight: 600; margin-bottom: 6px;">Account deletion scheduled</p>
								<p class="text-muted" style="font-size: 12px; line-height: 1.6;">Your account will be permanently deleted in 30 days. You can cancel this any time before then.</p>
								<button class="btn btn-outline btn-sm" style="margin-top: 10px;" disabled={gdprCancelLoading} onclick={handleGdprCancelDeletion}>
									{#if gdprCancelLoading}Cancelling...{:else}Cancel Deletion{/if}
								</button>
							</div>
						{/if}
						{#if gdprDeleteMsg}<div class="msg-success" style="margin-bottom: 12px; font-size: 12px;">{gdprDeleteMsg}</div>{/if}
						{#if !showDeleteConfirm}
							<p style="font-size: 13px; color: var(--clr-text-secondary); line-height: 1.6; margin-bottom: 12px;">Permanently delete your account and all associated data. Your data is kept for 30 days in case you change your mind.</p>
							<button class="btn btn-outline btn-sm" style="color: var(--clr-danger); border-color: rgba(239,68,68,0.3);" onclick={() => showDeleteConfirm = true}>Delete My Account</button>
						{:else}
							<div style="padding: 16px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.15); border-radius: var(--radius-md);">
								<h4 style="color: var(--clr-danger); font-size: 14px; margin-bottom: 12px;">Are you sure?</h4>
								<div style="font-size: 12px; color: var(--clr-text-secondary); line-height: 1.7; margin-bottom: 16px;">
									<p style="margin-bottom: 8px;">If you delete your account:</p>
									<p style="padding-left: 12px;">&#x2022; Your data is kept for 30 days, then permanently erased</p>
									<p style="padding-left: 12px;">&#x2022; You can cancel within 30 days by logging in</p>
									<p style="padding-left: 12px;">&#x2022; Posts, messages, and scan history will be removed</p>
									<p style="padding-left: 12px;">&#x2022; Active subscriptions will be cancelled</p>
								</div>
								<div style="margin-bottom: 12px;">
									<label class="label" for="gdpr-delete-pw" style="font-size: 11px; margin-bottom: 6px;">Enter your password to confirm</label>
									<input id="gdpr-delete-pw" class="input" type="password" placeholder="Your password" bind:value={gdprDeletePassword} />
								</div>
								{#if gdprDeleteError}<div class="msg-error" style="margin-bottom: 12px; font-size: 12px;">{gdprDeleteError}</div>{/if}
								<div style="display: flex; gap: 8px;">
									<button class="btn" style="background: var(--clr-danger); color: white; border: none; flex: 1;" disabled={gdprDeleteLoading || !gdprDeletePassword} onclick={handleGdprDelete}>
										{#if gdprDeleteLoading}Processing...{:else}Delete My Account{/if}
									</button>
									<button class="btn btn-outline" style="border-color: var(--clr-border);" onclick={() => { showDeleteConfirm = false; gdprDeletePassword = ''; gdprDeleteError = ''; }}>Cancel</button>
								</div>
							</div>
						{/if}
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
				<div class="rp-title"><span style="display:inline-flex;align-items:center;gap:6px;"><MessageCircle size={14} strokeWidth={2} /> Team Space</span></div>
				{#if isAgency}
					<p class="rp-desc">Share ideas and discuss with your team members.</p>
					<div class="team-avatars">
						<div class="team-avatar-sm"><User size={14} strokeWidth={1.8} /></div>
						<div class="team-avatar-sm"><User size={14} strokeWidth={1.8} /></div>
						<div class="team-avatar-sm"><User size={14} strokeWidth={1.8} /></div>
						<div class="team-avatar-sm plus">+</div>
					</div>
					<a href="/team" class="btn btn-outline btn-sm" style="width: 100%; text-align: center; margin-top: 10px;">Open Team →</a>
				{:else}
					<p class="rp-desc">Upgrade to Agency to unlock team collaboration, shared notes, and group discussions.</p>
					<button class="btn btn-blue btn-sm" style="width: 100%;" onclick={() => ui.openCheckout('agency')}>Upgrade to Agency</button>
				{/if}
			</div>

			<div class="rp-section">
				<div class="rp-title" style="display:flex;align-items:center;gap:6px;"><LayoutDashboard size={14} strokeWidth={2} /> Quick Stats</div>
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
					<span style="display:inline-flex;align-items:center;gap:6px;"><Search size={14} strokeWidth={2} /> New Scan</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/compare" class="rp-link-card">
					<span style="display:inline-flex;align-items:center;gap:6px;"><Scale size={14} strokeWidth={2} /> Compare</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/seo" class="rp-link-card">
					<span style="display:inline-flex;align-items:center;gap:6px;"><Target size={14} strokeWidth={2} /> SEO Tools</span>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				</a>
				<a href="/leaderboard" class="rp-link-card">
					<span style="display:inline-flex;align-items:center;gap:6px;"><Trophy size={14} strokeWidth={2} /> Leaderboard</span>
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

	.auth-section { max-width: 400px; margin: 0 auto; padding: 0 16px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; min-height: 100dvh; box-sizing: border-box; }
	.auth-section .field { width: 100%; } .auth-section .btn { width: 100%; } .auth-section .auth-toggle { width: 100%; }
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
	.dash-layout { display: grid; grid-template-columns: 180px 1fr 210px; gap: 0; min-height: calc(100vh - 70px); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); overflow: hidden; width: 100%; margin: 0; }

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
	.compare-col { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px; text-align: center; transition: all var(--duration-fast); }
	.compare-col.clickable { cursor: pointer; }
	.compare-col.clickable:hover { border-color: var(--clr-border-light); transform: translateY(-2px); box-shadow: var(--shadow-md); }
	.compare-col.featured { border-color: var(--clr-gold); box-shadow: var(--shadow-glow-gold); }
	.compare-header { font-weight: 700; font-size: 14px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--clr-border); }
	.compare-header.pro { color: var(--clr-gold); }
	.compare-header.agency { color: var(--clr-blue); }
	.compare-feat { font-size: 12px; color: var(--clr-text-secondary); padding: 3px 0; }
	.compare-feat.dim { color: var(--clr-text-muted); opacity: 0.5; }
	.active-plan { border-color: var(--clr-success); box-shadow: 0 0 0 1px var(--clr-success); }

	/* ── Billing Hero ─────────────────────── */
	.billing-hero { border-left: 3px solid var(--clr-gold); }
	.billing-hero-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
	.billing-hero-left { display: flex; align-items: center; gap: 14px; }
	.billing-hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
	.billing-plan-icon { width: 48px; height: 48px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; background: var(--clr-bg-elevated); border: 1px solid var(--clr-border); }
	.billing-plan-icon.gift { background: rgba(245,166,35,0.08); border-color: rgba(245,166,35,0.2); }
	.billing-plan-icon.stripe { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.2); }
	.billing-plan-name { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
	.billing-plan-desc { font-size: 12px; color: var(--clr-text-secondary); margin-top: 2px; }
	.billing-type-badge { font-size: 10px; padding: 3px 10px; border-radius: var(--radius-full); font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; }
	.billing-type-badge.gift { background: rgba(245,166,35,0.12); color: var(--clr-gold); }
	.billing-type-badge.stripe { background: rgba(99,102,241,0.12); color: #818cf8; }
	.billing-type-badge.free { background: var(--clr-border); color: var(--clr-text-muted); }

	/* ── Billing Warning Banner ───────────── */
	.billing-warning { display: flex; align-items: center; gap: 14px; padding: 14px 20px; background: rgba(245,166,35,0.06); border: 1px solid rgba(245,166,35,0.2); border-radius: var(--radius-lg); margin-bottom: 20px; flex-wrap: wrap; }
	.billing-warning.expired { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.2); }
	.billing-warning-icon { font-size: 22px; flex-shrink: 0; }
	.billing-warning-content { flex: 1; min-width: 200px; }
	.billing-warning-title { font-size: 14px; font-weight: 700; }
	.billing-warning.expired .billing-warning-title { color: var(--clr-danger); }
	.billing-warning-sub { font-size: 12px; color: var(--clr-text-secondary); margin-top: 2px; }

	/* ── Billing Portal Row ───────────────── */
	.billing-portal-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

	/* ── Billing Detail Grid ──────────────── */
	.billing-detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
	.billing-detail-label { font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
	.billing-detail-value { font-size: 15px; font-weight: 700; }

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
		.auth-section[style*="flex-direction: row"] { flex-direction: column !important; }
		.auth-section[style*="flex-direction: row"] > div:first-child { display: none !important; }
		.auth-section[style*="flex-direction: row"] > div:last-child { padding: 32px 20px !important; }
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
	@media (max-width: 640px) {
		.form-grid { grid-template-columns: 1fr; }
		.plan-compare { grid-template-columns: 1fr; }
		.billing-hero-row { flex-direction: column; align-items: flex-start; }
		.billing-hero-left { flex-direction: column; align-items: flex-start; gap: 10px; }
		.billing-hero-actions { width: 100%; }
		.billing-hero-actions .btn { flex: 1; text-align: center; }
		.billing-plan-name { font-size: 18px; }
		.billing-detail-grid { grid-template-columns: repeat(2, 1fr); }
		.billing-portal-row { flex-direction: column; align-items: flex-start; gap: 12px; }
		.billing-portal-row .btn { width: 100%; text-align: center; }
		.billing-warning { flex-direction: column; text-align: center; gap: 10px; }
		.billing-warning .btn { width: 100%; }
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
		.billing-detail-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
		.billing-plan-icon { width: 40px; height: 40px; font-size: 18px; }
		.billing-plan-name { font-size: 16px; gap: 6px; }
		.billing-type-badge { font-size: 9px; padding: 2px 8px; }
	}
	/* Email verification banner */
	.verify-banner { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: var(--radius-lg); margin-bottom: 16px; overflow: hidden; }
	.verify-banner-inner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }

	/* ── Report Scheduling ─────────────────── */
	.rpt-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
	.rpt-stat { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 16px; text-align: center; transition: border-color 0.2s; }
	.rpt-stat:hover { border-color: var(--clr-gold-dim); }
	.rpt-stat-val { font-size: 28px; font-weight: 800; font-family: var(--font-mono); color: var(--clr-gold); line-height: 1; }
	.rpt-stat-lbl { font-size: 10px; color: var(--clr-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }

	.rpt-card { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 10px; transition: all 0.2s; }
	.rpt-card:hover { border-color: var(--clr-gold-dim); box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
	.rpt-paused { opacity: 0.55; }

	.rpt-card-top { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
	.rpt-url { font-size: 14px; font-weight: 700; font-family: var(--font-mono); color: var(--clr-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.rpt-recip { font-size: 12px; color: var(--clr-text-muted); margin-top: 3px; }
	.rpt-score { font-size: 22px; font-weight: 800; font-family: var(--font-mono); flex-shrink: 0; }

	.rpt-card-btm { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--clr-border); }
	.rpt-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
	.rpt-badge { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border-radius: var(--radius-full); }
	.rpt-active { background: rgba(16,185,129,0.12); color: var(--clr-success); }
	.rpt-paused-badge { background: rgba(245,158,11,0.12); color: var(--clr-warning); }

	@media (max-width: 640px) {
		.rpt-stats { grid-template-columns: repeat(2, 1fr); }
		.rpt-card-btm { flex-direction: column; gap: 10px; align-items: flex-start; }
	}

	/* ── API Usage ───────────────────── */
	.api-usage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
	.api-stat { background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 16px; text-align: center; }
	.api-stat-val { font-size: 24px; font-weight: 800; font-family: var(--font-mono); color: var(--clr-gold); }
	.api-stat-lbl { font-size: 11px; color: var(--clr-text-muted); margin-top: 4px; text-transform: uppercase; font-weight: 600; }
	.api-chart { display: flex; align-items: flex-end; gap: 2px; height: 80px; }
	.api-chart-bar { flex: 1; background: var(--clr-border); border-radius: 2px 2px 0 0; min-height: 2px; position: relative; height: 100%; display: flex; align-items: flex-end; }
	.api-chart-fill { width: 100%; background: var(--clr-gold); border-radius: 2px 2px 0 0; transition: height 0.3s; }
	.api-month-row { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--clr-border); font-size: 13px; }
	.api-month-row:last-child { border-bottom: none; }
	.api-month-label { font-weight: 600; }
	.api-month-val { font-family: var(--font-mono); color: var(--clr-gold); }
	.api-log-header { display: grid; grid-template-columns: 1fr 60px 50px 50px 80px; gap: 8px; padding: 8px 16px; font-size: 10px; color: var(--clr-text-muted); font-family: var(--font-mono); text-transform: uppercase; border-bottom: 1px solid var(--clr-border); }
	.api-log-row { display: grid; grid-template-columns: 1fr 60px 50px 50px 80px; gap: 8px; padding: 8px 16px; font-size: 12px; border-bottom: 1px solid var(--clr-border); align-items: center; }
	.api-log-row:last-child { border-bottom: none; }
	.api-log-endpoint { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.api-log-method { font-weight: 700; font-size: 10px; }
	.api-ok { color: var(--clr-success); font-weight: 700; }
	.api-err { color: var(--clr-danger); font-weight: 700; }
	@media (max-width: 640px) { .api-usage-grid { grid-template-columns: repeat(2, 1fr); } .api-log-header, .api-log-row { grid-template-columns: 1fr 50px 50px; } .api-log-row span:nth-child(4), .api-log-row span:nth-child(5), .api-log-header span:nth-child(4), .api-log-header span:nth-child(5) { display: none; } }

	/* ── Report History ──────────────── */
	.rpt-history { border-top: 1px solid var(--clr-border); padding: 8px 16px; background: var(--clr-bg-deep); border-radius: 0 0 var(--radius-lg) var(--radius-lg); }
	.rpt-hist-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 12px; border-bottom: 1px solid var(--clr-border); }
	.rpt-hist-row:last-child { border-bottom: none; }
	.rpt-hist-date { font-family: var(--font-mono); color: var(--clr-text-secondary); min-width: 100px; }
	.rpt-hist-recip { flex: 1; color: var(--clr-text-primary); }
	.rpt-hist-status { font-weight: 700; font-family: var(--font-mono); font-size: 11px; padding: 2px 8px; border-radius: var(--radius-full); }
	.rpt-delivered { background: rgba(34,197,94,0.12); color: var(--clr-success); }
	.rpt-failed { background: rgba(239,68,68,0.12); color: var(--clr-danger); }

</style>


