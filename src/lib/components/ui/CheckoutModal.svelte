<script lang="ts">
	import { ui } from '$lib/stores/ui';
	import { PLAN_PRICING } from '$lib/types';
	import { safeGetStorage, safeSetStorage, safeRedirect, isValidEmail } from '$lib/utils/security';
	import * as api from '$lib/api/client';

	let email = $state(safeGetStorage('bscan_email') || '');
	let emailError = $state('');
	let submitting = $state(false);

	const plan = $derived($ui.checkoutPlan);
	const interval = $derived($ui.billingInterval);
	const planName = $derived(plan.charAt(0).toUpperCase() + plan.slice(1));
	const price = $derived(PLAN_PRICING[plan][interval]);
	const isAnnual = $derived(interval === 'annual');

	async function submit() {
		emailError = '';
		if (!isValidEmail(email)) {
			emailError = 'Please enter a valid email address.';
			return;
		}

		submitting = true;
		safeSetStorage('bscan_email', email);

		try {
			const data = await api.createCheckout(plan, email, interval);
			const safe = safeRedirect(data.checkout_url);
			if (safe) window.location.href = safe;
			else emailError = 'Could not start checkout — invalid redirect.';
		} catch (err) {
			emailError = err instanceof Error ? err.message : 'Network error.';
		}

		submitting = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') submit();
		if (e.key === 'Escape') ui.closeCheckout();
	}
</script>

{#if $ui.checkoutOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overlay" onclick={(e) => e.target === e.currentTarget && ui.closeCheckout()} onkeydown={handleKeydown}>
		<div class="modal">
			<button class="modal-close" onclick={() => ui.closeCheckout()}>✕</button>

			<div class="checkout-icon">⚡</div>
			<div class="checkout-tag badge" class:badge-gold={plan === 'pro'} class:badge-blue={plan === 'agency'}>
				{planName} · {isAnnual ? 'Annual' : 'Monthly'}
			</div>

			<h3>Upgrade to <span class="text-gold">{planName}</span></h3>
			<p class="text-secondary" style="font-size: 13px; margin-bottom: 20px;">
				£{price}/{isAnnual ? 'mo (billed annually)' : 'mo'} — enter your email to continue to secure checkout.
			</p>

			<div class="field">
				<label class="label" for="checkout-email">Email address</label>
				<input
					class="input"
					class:input-error={emailError}
					type="email"
					id="checkout-email"
					placeholder="you@company.com"
					autocomplete="email"
					bind:value={email}
					onkeydown={handleKeydown}
				/>
				{#if emailError}
					<div class="error-msg">{emailError}</div>
				{/if}
			</div>

			<button
				class="btn {plan === 'pro' ? 'btn-gold' : 'btn-blue'}"
				style="width: 100%; margin-top: 16px;"
				disabled={submitting}
				onclick={submit}
			>
				{#if submitting}
					<span class="spinner spinner-sm"></span> Redirecting to Stripe...
				{:else}
					Continue to Checkout →
				{/if}
			</button>

			<div class="checkout-footer">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
				Secured by Stripe · 256-bit encryption
			</div>
		</div>
	</div>
{/if}

<style>
	.checkout-icon {
		font-size: 28px;
		margin-bottom: 8px;
	}

	.checkout-tag {
		margin-bottom: 12px;
	}

	h3 {
		margin-bottom: 4px;
	}

	.field {
		margin-bottom: 4px;
	}

	.error-msg {
		font-size: 12px;
		color: var(--clr-danger);
		margin-top: 6px;
	}

	.checkout-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: var(--space-md);
		font-size: 11px;
		color: var(--clr-text-muted);
	}
</style>
