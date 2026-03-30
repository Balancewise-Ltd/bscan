<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import { ui } from '$lib/stores/ui';
  import { onMount } from 'svelte';
  import { getNotificationCount } from '$lib/api/client';
  import { Search, Users, Trophy, BarChart3, Scale, Bell, User, Wrench, MessageCircle, ChevronDown, Layers, BellDot } from '@lucide/svelte';

  let notifCount = $state(0);
  let toolsOpen = $state(false);

  onMount(() => {
    if ($auth.token) {
      getNotificationCount().then(r => notifCount = r.count).catch(() => {});
      setInterval(() => {
        if ($auth.token) getNotificationCount().then(r => notifCount = r.count).catch(() => {});
      }, 30000);
    }
  });

  const tools = [
    { href: '/', label: 'Scanner', icon: Search, desc: 'Audit any website instantly' },
    { href: '/seo', label: 'SEO Dashboard', icon: BarChart3, desc: 'Keywords, backlinks & AI visibility' },
    { href: '/compare', label: 'Compare', icon: Scale, desc: 'Compare two websites side by side' },
    { href: '/monitoring', label: 'Monitor', icon: Bell, desc: 'Track website changes 24/7' },
    { href: '/deep-crawl', label: 'Deep Crawl', icon: Layers, desc: 'Crawl multiple pages at once' },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, desc: 'Top-scoring websites' },
  ];

  const mobileLinks = [
    { href: '/', label: 'Scanner', icon: Search },
    { href: '/seo', label: 'SEO Dashboard', icon: BarChart3 },
    { href: '/compare', label: 'Compare', icon: Scale },
    { href: '/monitoring', label: 'Monitoring', icon: Bell },
    { href: '/deep-crawl', label: 'Deep Crawl', icon: Layers },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/wisers', label: 'Wisers Community', icon: Users },
    { href: '/account', label: 'Account', icon: User },
  ];

  function closeTools() { toolsOpen = false; }
</script>

<svelte:window onclick={() => toolsOpen = false} />

<nav class="navbar">
  <a href="/" class="nav-brand">
    <span class="brand-text">Balancewise <span class="brand-accent">Technologies</span></span>
  </a>

  <div class="nav-links">
    <!-- Tools Dropdown -->
    <div class="nav-dropdown">
      <button class="nav-link nav-tools-trigger" class:active={tools.some(t => $page.url.pathname === t.href)}
        onclick={(e) => { e.stopPropagation(); toolsOpen = !toolsOpen; }}>
        <Layers size={15} strokeWidth={2} />
        Tools
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>

      {#if toolsOpen}
        <div class="tools-dropdown" onclick={(e) => e.stopPropagation()}>
          {#each tools as tool}
            <a href={tool.href} class="tools-item" class:active={$page.url.pathname === tool.href} onclick={closeTools}>
              <span class="tools-icon"><svelte:component this={tool.icon} size={18} strokeWidth={1.8} /></span>
              <div>
                <div class="tools-label">{tool.label}</div>
                <div class="tools-desc">{tool.desc}</div>
              </div>
            </a>
          {/each}
          <div class="tools-footer">
            <a href="https://balancewises.io/#services" onclick={closeTools}>All Services</a>
            <a href="/api-docs" onclick={closeTools}>API Docs</a>
          </div>
        </div>
      {/if}
    </div>

    <!-- Wisers Direct Link -->
    <a href="/wisers" class="nav-link nav-wisers" class:active={$page.url.pathname.startsWith('/wisers')}>
      <Users size={15} strokeWidth={2} />
      Wisers
    </a>

    <!-- Notification Bell -->
    <a href="/notifications" class="nav-icon-btn" title="Notifications">
      <BellDot size={17} strokeWidth={2} />
      {#if notifCount > 0}<span class="notif-badge">{notifCount}</span>{/if}
    </a>

    <!-- Get a Quote -->
    <a href="https://balancewises.io/#contact" class="btn btn-blue btn-sm nav-cta">Get a Quote</a>

    <!-- Account -->
    <a href="/account" class="nav-link nav-account" title="My Account">
      {#if $auth.user}
        <span class="account-avatar">{($auth.user.name || $auth.user.email)[0].toUpperCase()}</span>
      {:else}
        <User size={15} strokeWidth={2} />
      {/if}
    </a>

    <!-- Mobile Toggle -->
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
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: var(--nav-height); padding: 0 var(--space-xl);
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(6, 10, 20, 0.88); backdrop-filter: blur(24px) saturate(1.2);
    border-bottom: 1px solid var(--clr-border);
  }
  .nav-brand { text-decoration: none; }
  .brand-text { font-weight: 700; font-size: 15px; color: var(--clr-text-primary); letter-spacing: -0.3px; }
  .brand-accent { color: var(--clr-gold); }
  .nav-links { display: flex; align-items: center; gap: 4px; }
  .nav-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: var(--radius-sm);
    color: var(--clr-text-secondary); font-size: 13px; font-weight: 500;
    transition: all var(--duration-fast); text-decoration: none; border: none; background: none; cursor: pointer; font-family: inherit;
  }
  .nav-link:hover { color: var(--clr-text-primary); background: rgba(255, 255, 255, 0.04); }
  .nav-link.active { color: var(--clr-blue); background: var(--clr-blue-dim); }

  .nav-wisers { font-weight: 600; }
  .nav-wisers.active { color: var(--clr-gold); background: rgba(245, 166, 35, 0.08); }

  /* Tools Dropdown */
  .nav-dropdown { position: relative; }
  .nav-tools-trigger { gap: 5px; }
  .tools-dropdown {
    position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
    width: 320px; background: var(--clr-bg-card); border: 1px solid var(--clr-border);
    border-radius: 12px; padding: 8px; z-index: 200;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    animation: dropIn 0.15s ease-out;
  }
  @keyframes dropIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  .tools-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px;
    border-radius: 8px; text-decoration: none; color: var(--clr-text-primary);
    transition: background 0.1s;
  }
  .tools-item:hover { background: rgba(255,255,255,0.04); }
  .tools-item.active { background: var(--clr-blue-dim); }
  .tools-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.04); color: var(--clr-text-secondary); flex-shrink: 0; }
  .tools-item:hover .tools-icon { color: var(--clr-blue); }
  .tools-label { font-size: 13px; font-weight: 600; }
  .tools-desc { font-size: 11px; color: var(--clr-text-muted); margin-top: 1px; }
  .tools-footer { display: flex; gap: 12px; padding: 8px 12px; margin-top: 4px; border-top: 1px solid var(--clr-border); }
  .tools-footer a { font-size: 11px; color: var(--clr-text-muted); text-decoration: none; }
  .tools-footer a:hover { color: var(--clr-gold); }

  /* Icon Button */
  .nav-icon-btn {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    color: var(--clr-text-secondary); text-decoration: none;
    transition: all 0.1s;
  }
  .nav-icon-btn:hover { background: rgba(255,255,255,0.06); color: var(--clr-text-primary); }
  .notif-badge {
    position: absolute; top: 1px; right: 0; font-size: 9px; font-weight: 800;
    background: var(--clr-gold); color: #000; padding: 0 4px;
    border-radius: 99px; min-width: 14px; text-align: center; line-height: 14px;
  }

  .nav-account { color: var(--clr-gold) !important; margin-left: 2px; }
  .account-avatar {
    display: inline-flex; width: 28px; height: 28px; border-radius: 50%;
    background: var(--clr-gold-dim); border: 1px solid rgba(240, 165, 0, 0.3);
    color: var(--clr-gold); align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
  }
  .nav-cta { margin-left: 4px; }

  .mobile-toggle {
    display: none; background: none; border: 1px solid var(--clr-border);
    border-radius: var(--radius-sm); color: var(--clr-text-secondary); cursor: pointer;
    width: 36px; height: 36px; align-items: center; justify-content: center; margin-left: 8px;
  }
  .mobile-backdrop { display: none; }
  .mobile-menu { display: none; }

  @media (max-width: 768px) {
    .navbar { padding: 0 var(--space-md); }
    .nav-dropdown, .nav-wisers, .nav-cta, .nav-icon-btn { display: none; }
    .mobile-toggle { display: flex; }
    .mobile-backdrop {
      display: block; position: fixed; inset: 0; z-index: 98;
      background: rgba(0, 0, 0, 0.5); animation: fadeIn var(--duration-fast);
    }
    .mobile-menu {
      display: flex; flex-direction: column; position: fixed;
      top: var(--nav-height); left: 0; right: 0; z-index: 99;
      background: var(--clr-bg-card); border-bottom: 1px solid var(--clr-border);
      padding: var(--space-sm); animation: fadeDown var(--duration-normal) var(--ease-out);
      max-height: calc(100vh - var(--nav-height)); overflow-y: auto;
    }
    .mobile-item {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      border-radius: var(--radius-md); color: var(--clr-text-primary);
      text-decoration: none; font-size: 14px; font-weight: 500;
      transition: background var(--duration-fast);
    }
    .mobile-item:hover { background: rgba(255, 255, 255, 0.04); }
    .mobile-icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; color: var(--clr-text-secondary); }
    .mobile-arrow { margin-left: auto; color: var(--clr-text-muted); font-size: 18px; }
    .mobile-divider { height: 1px; background: var(--clr-border); margin: var(--space-xs) var(--space-md); }
    .mobile-cta { color: var(--clr-gold); }
    .mobile-cta .mobile-icon { color: var(--clr-gold); }
  }
</style>