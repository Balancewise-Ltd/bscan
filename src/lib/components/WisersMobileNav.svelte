<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth';
  import { wsUnreadDMs, wsNotifCount } from '$lib/stores/wisers-ws';

  const path = $derived($page.url.pathname);
  const isHome = $derived(path === '/wisers');
  const isGroups = $derived(path.startsWith('/wisers/communities'));
  const isInbox = $derived(path.startsWith('/wisers/messages') || path.startsWith('/notifications'));
  const isProfile = $derived(path.startsWith('/wisers/') && !isGroups && !isInbox && !isHome && path !== '/wisers/mentorship');
</script>

<nav class="wmn">
  <a href="/wisers" class="wmn-item" class:active={isHome}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill={isHome ? 'currentColor' : 'none'} stroke="currentColor" stroke-width={isHome ? '0' : '1.8'}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke={isHome ? '#0a0a0f' : 'currentColor'} stroke-width="1.8"/>
    </svg>
    <span>Home</span>
  </a>

  <a href="/wisers/communities" class="wmn-item" class:active={isGroups}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
    <span>Groups</span>
  </a>

  <button class="wmn-fab" aria-label="Create post" onclick={() => window.dispatchEvent(new CustomEvent('wisers:create'))}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>

  <a href="/wisers/messages" class="wmn-item" class:active={isInbox}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill={isInbox ? 'currentColor' : 'none'} stroke="currentColor" stroke-width={isInbox ? '0' : '1.8'}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Inbox</span>
    {#if $wsUnreadDMs + $wsNotifCount > 0}
      <span class="wmn-badge">{$wsUnreadDMs + $wsNotifCount > 9 ? '9+' : $wsUnreadDMs + $wsNotifCount}</span>
    {/if}
  </a>

  <a href="/wisers/{$auth.user?.username || 'me'}" class="wmn-item" class:active={isProfile}>
    {#if $auth.user}
      {#if $auth.user.avatar_url}
        <img src={$auth.user.avatar_url} alt="" class="wmn-av" class:active={isProfile} />
      {:else}
        <div class="wmn-av" class:active={isProfile}>{($auth.user.name || $auth.user.email)[0].toUpperCase()}</div>
      {/if}
    {:else}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    {/if}
    <span>Profile</span>
  </a>
</nav>

<style>
  .wmn { display: none; }

  @media (max-width: 768px) {
    .wmn {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: #0a0a0f;
      border-top: 1px solid #1a1a2a;
      z-index: 200;
      align-items: center;
      justify-content: space-around;
      padding: 0;
      padding-bottom: env(safe-area-inset-bottom, 0);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    :global([data-wisers-theme="light"]) .wmn,
    :global(.light) .wmn {
      background: #ffffff;
      border-top-color: #e4e4e7;
    }

    .wmn-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      color: #606770;
      text-decoration: none;
      font-size: 10px;
      font-weight: 500;
      padding: 4px 0;
      width: 56px;
      position: relative;
      -webkit-tap-highlight-color: transparent;
      transition: color 0.12s;
    }
    .wmn-item.active { color: #f5a623; }
    .wmn-item:active { transform: scale(0.92); }
    :global([data-wisers-theme="light"]) .wmn-item { color: #8a8d91; }
    :global([data-wisers-theme="light"]) .wmn-item.active { color: #d4a017; }

    .wmn-fab {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: #f5a623;
      border: 3px solid #0a0a0f;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: -22px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.12s;
    }
    .wmn-fab:active { transform: scale(0.9); }
    :global([data-wisers-theme="light"]) .wmn-fab { border-color: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }

    .wmn-badge {
      position: absolute;
      top: 0;
      right: 4px;
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      line-height: 1;
    }

    .wmn-av {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f5a623, #e09100);
      color: #000;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      object-fit: cover;
    }
    .wmn-av.active { box-shadow: 0 0 0 2px #f5a623; }
  }
</style>
