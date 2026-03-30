<script lang="ts">
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { Search, BellDot, Users, Trophy, BarChart3, Scale, Bell, User, Wrench, MessageCircle } from '@lucide/svelte';

	import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let notifCount = $state(0);

  onMount(() => {
    if ($auth.token) {
      api.getNotificationCount().then(r => notifCount = r.count).catch(() => {});
      setInterval(() => {
        if ($auth.token) api.getNotificationCount().then(r => notifCount = r.count).catch(() => {});
      }, 30000);
    }
  });

  const links = [
		{ href: '/', label: 'Scanner', key: '/', icon: Search },
		{ href: '/leaderboard', label: 'Leaderboard', key: '/leaderboard', icon: Trophy },
		{ href: '/seo', label: 'SEO', key: '/seo', icon: BarChart3 },
		{ href: '/compare', label: 'Compare', key: '/compare', icon: Scale },
		{ href: '/monitoring', label: 'Monitor', key: '/monitoring', icon: Bell },
		{ href: '/wisers', label: 'Wisers', key: '/wisers', icon: Users }
	];

	const mobileLinks = [
		{ href: '/account', label: 'Login / Account', icon: User },
		{ href: '/monitoring', label: 'Monitoring', icon: Bell },
		{ href: '/seo', label: 'SEO Dashboard', icon: BarChart3 },
		{ href: '/compare', label: 'Compare', icon: Scale },
		{ href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
		{ href: '/', label: 'Scanner', icon: Search },
		{ href: '/wisers', label: 'Wisers', icon: Users }
	];
</script>

<nav class="navbar">
	<a href="/" class="nav-brand">
		<span class="brand-text">Balancewise <span class="brand-accent">Technologies</span></span>
	</a>

	<div class="nav-links">
		{#each links as link}
			<a
				href={link.href}
				class="nav-link"
				class:active={$page.url.pathname === link.key}
			>
				<svelte:component this={link.icon} size={15} strokeWidth={2} />
				{link.label}
			</a>
		{/each}

		<a href="https://balancewises.io/#contact" class="btn btn-blue btn-sm nav-cta">Get a Quote</a>

		<a href="/account" class="nav-link nav-account" title="My Account">
			{#if $auth.user}
				<span class="account-avatar">{($auth.user.name || $auth.user.email)[0].toUpperCase()}</span>
			{:else}
				<User size={15} strokeWidth={2} />
				Account
			{/if}
		</a>

		<button class="mobile-toggle" onclick={() => ui.toggleMobileMenu()} aria-label="Menu">
			{#if $ui.mobileMenuOpen}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
			{/if}
		</button>
	</div>
</nav>

<!-- Mobile Menu -->
{#if $ui.mobileMenuOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="mobile-backdrop" onclick={() => ui.closeMobileMenu()} onkeydown={(e) => e.key === 'Escape' && ui.closeMobileMenu()}></div>
	<div class="mobile-menu">
		{#each mobileLinks as link}
			<a href={link.href} class="mobile-item" onclick={() => ui.closeMobileMenu()}>
				<span class="mobile-icon"><svelte:component this={link.icon} size={18} strokeWidth={1.8} /></span>
				<span>{link.label}</span>
				<span class="mobile-arrow">›</span>
			</a>
		{/each}
		<div class="mobile-divider"></div>
		<a href="https://balancewises.io/#services" class="mobile-item" onclick={() => ui.closeMobileMenu()}>
			<span class="mobile-icon"><Wrench size={18} strokeWidth={1.8} /></span>
			<span>Services</span>
			<span class="mobile-arrow">›</span>
		</a>
		<a href="https://balancewises.io/#contact" class="mobile-item mobile-cta" onclick={() => ui.closeMobileMenu()}>
			<span class="mobile-icon"><MessageCircle size={18} strokeWidth={1.8} /></span>
			<span>Get a Quote</span>
			<span class="mobile-arrow">›</span>
		</a>
	</div>
{/if}

<style>
	.navbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		height: var(--nav-height);
		padding: 0 var(--space-xl);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(6, 10, 20, 0.88);
		backdrop-filter: blur(24px) saturate(1.2);
		border-bottom: 1px solid var(--clr-border);
	}

	.nav-brand {
		text-decoration: none;
	}

	.brand-text {
		font-weight: 700;
		font-size: 15px;
		color: var(--clr-text-primary);
		letter-spacing: -0.3px;
	}

	.brand-accent {
		color: var(--clr-gold);
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: var(--radius-sm);
		color: var(--clr-text-secondary);
		font-size: 13px;
		font-weight: 500;
		transition: all var(--duration-fast);
		text-decoration: none;
	}

	.nav-link:hover {
		color: var(--clr-text-primary);
		background: rgba(255, 255, 255, 0.04);
	}

	.nav-link.active {
		color: var(--clr-blue);
		background: var(--clr-blue-dim);
	}

	.nav-account {
		color: var(--clr-gold) !important;
		margin-left: 4px;
	}

	.account-avatar {
		display: inline-flex;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--clr-gold-dim);
		border: 1px solid rgba(240, 165, 0, 0.3);
		color: var(--clr-gold);
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 700;
	}

	.nav-cta {
		margin-left: 8px;
	}

	.mobile-toggle {
		display: none;
		background: none;
		border: 1px solid var(--clr-border);
		border-radius: var(--radius-sm);
		color: var(--clr-text-secondary);
		cursor: pointer;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		margin-left: 8px;
	}

	.mobile-backdrop {
		display: none;
	}

	.mobile-menu {
		display: none;
	}

	@media (max-width: 768px) {
		.navbar {
			padding: 0 var(--space-md);
		}

		.nav-link:not(.nav-account), .nav-cta {
			display: none;
		}

		.mobile-toggle {
			display: flex;
		}

		.mobile-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 98;
			background: rgba(0, 0, 0, 0.5);
			animation: fadeIn var(--duration-fast);
		}

		.mobile-menu {
			display: flex;
			flex-direction: column;
			position: fixed;
			top: var(--nav-height);
			left: 0;
			right: 0;
			z-index: 99;
			background: var(--clr-bg-card);
			border-bottom: 1px solid var(--clr-border);
			padding: var(--space-sm);
			animation: fadeDown var(--duration-normal) var(--ease-out);
			max-height: calc(100vh - var(--nav-height));
			overflow-y: auto;
		}

		.mobile-item {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 14px 16px;
			border-radius: var(--radius-md);
			color: var(--clr-text-primary);
			text-decoration: none;
			font-size: 14px;
			font-weight: 500;
			transition: background var(--duration-fast);
		}

		.mobile-item:hover {
			background: rgba(255, 255, 255, 0.04);
		}

		.mobile-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			color: var(--clr-text-secondary);
		}

		.mobile-arrow {
			margin-left: auto;
			color: var(--clr-text-muted);
			font-size: 18px;
		}

		.mobile-divider {
			height: 1px;
			background: var(--clr-border);
			margin: var(--space-xs) var(--space-md);
		}

		.mobile-cta {
			color: var(--clr-gold);
		}

		.mobile-cta .mobile-icon {
			color: var(--clr-gold);
		}
	}
</style>
