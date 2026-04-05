import { writable, derived } from 'svelte/store';
import type { BillingInterval } from '$lib/types';

const _mobileMenuOpen = writable(false);
const _billingInterval = writable<BillingInterval>('monthly');
const _checkoutOpen = writable(false);
const _checkoutPlan = writable<'pro' | 'agency'>('pro');
const _paywallOpen = writable(false);
const _paywallTitle = writable('');
const _paywallMessage = writable('');

const _store = derived(
	[_mobileMenuOpen, _billingInterval, _checkoutOpen, _checkoutPlan, _paywallOpen, _paywallTitle, _paywallMessage],
	([$mobileMenuOpen, $billingInterval, $checkoutOpen, $checkoutPlan, $paywallOpen, $paywallTitle, $paywallMessage]) => ({
		mobileMenuOpen: $mobileMenuOpen,
		billingInterval: $billingInterval,
		checkoutOpen: $checkoutOpen,
		checkoutPlan: $checkoutPlan,
		paywallOpen: $paywallOpen,
		paywallTitle: $paywallTitle,
		paywallMessage: $paywallMessage
	})
);

function toggleMobileMenu() { _mobileMenuOpen.update((v) => !v); }
function closeMobileMenu() { _mobileMenuOpen.set(false); }

function setBillingInterval(interval: BillingInterval) { _billingInterval.set(interval); }

function openCheckout(plan: 'pro' | 'agency') {
	_checkoutPlan.set(plan);
	_checkoutOpen.set(true);
}
function closeCheckout() { _checkoutOpen.set(false); }

function showPaywall(title?: string, message?: string) {
	_paywallTitle.set(title || "You've used your 3 free scans");
	_paywallMessage.set(message || 'Upgrade to Starter for unlimited website audits, PDF exports, and scan history — or let our team handle the fixes for you.');
	_paywallOpen.set(true);
}
function closePaywall() { _paywallOpen.set(false); }

export const ui = {
	subscribe: _store.subscribe,
	toggleMobileMenu,
	closeMobileMenu,
	setBillingInterval,
	openCheckout,
	closeCheckout,
	showPaywall,
	closePaywall
};
