<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { wsNotifCount, wsUnreadDMs } from '$lib/stores/wisers-ws';
  import { page } from '$app/stores';

  let theme = $state<'dark' | 'light'>('dark');
  let confirmText = $state('');
  let deleting = $state(false);
  let error = $state('');

  const canDelete = $derived(confirmText === 'DELETE');
  const currentPath = $derived($page.url.pathname);

  onMount(() => {
    document.body.classList.add('wisers-page');
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; document.documentElement.setAttribute('data-wisers-theme', 'light'); }

    if (!$auth.token) {
      goto('/wisers');
    }

    return () => { document.body.classList.remove('wisers-page'); };
  });

  async function handleDelete() {
    if (!canDelete) return;
    deleting = true;
    error = '';
    try {
      /* In a real implementation, this would call the API to delete the account */
      await new Promise(r => setTimeout(r, 1000));
      /* After deletion: clear auth, redirect to landing */
      /* auth.logout(); goto('/'); */
      error = 'Account deletion is not yet enabled. Contact support@balancewises.io for help.';
    } catch {
      error = 'Something went wrong. Please try again or contact support.';
    }
    deleting = false;
  }

  function initial(name: string) {
    return (name || '?').charAt(0).toUpperCase();
  }
</script>

<svelte:head>
  <title>Delete Account - Wisers</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="w" class:light={theme === 'light'}>
  <!-- TOP BAR -->
  <header class="w-topbar">
    <div class="w-topbar-inner">
      <a href="/wisers" class="w-logo">W<span>isers</span></a>
      <h1 class="w-page-title">Delete Account</h1>
      <div class="w-topbar-right">
        {#if $auth.user}
          <a href="/wisers/{$auth.user.username || 'me'}" class="w-avatar-sm" title="Profile">
            {initial($auth.user.name || $auth.user.email)}
          </a>
        {/if}
      </div>
    </div>
  </header>

  <div class="w-body">
    <!-- LEFT SIDEBAR -->
    <aside class="w-sidebar-left">
      {#if $auth.user}
        <a href="/wisers/{$auth.user.username || 'me'}" class="w-profile-card">
          <div class="w-avatar-lg">{initial($auth.user.name || $auth.user.email)}</div>
          <div class="w-profile-name">{$auth.user.name}</div>
          <div class="w-profile-handle">@{$auth.user.username || 'you'}</div>
        </a>
      {/if}
      <nav class="w-sidebar-nav">
        <a href="/wisers" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          Home
        </a>
        <a href="/notifications" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Notifications
          {#if $wsNotifCount > 0}<span class="w-count" style="background:#ef4444;color:#fff;">{$wsNotifCount > 9 ? '9+' : $wsNotifCount}</span>{/if}
        </a>
        <a href="/wisers/messages" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Messages
          {#if $wsUnreadDMs > 0}<span class="w-count" style="background:#ef4444;color:#fff;">{$wsUnreadDMs > 9 ? '9+' : $wsUnreadDMs}</span>{/if}
        </a>
        <a href="/settings" class="w-sidebar-link w-sidebar-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </a>
      </nav>
      <div class="w-sidebar-divider"></div>
      <nav class="w-sidebar-nav">
        <a href="/wisers/communities" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Communities
        </a>
        <a href="/wisers/mentorship" class="w-sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
          Mentorship
        </a>
      </nav>
      <div class="w-sidebar-divider"></div>
      <a href="https://balancewises.io" class="w-sidebar-back" target="_blank">Balancewise Technologies</a>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="w-main">
      <div class="w-delete-scroll">

        <a href="/settings" class="w-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Settings
        </a>

        <div class="w-delete-card">
          <!-- Warning icon -->
          <div class="w-delete-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          <h2 class="w-delete-title">Delete your account</h2>

          <div class="w-delete-warning">
            <p>This action is <strong>permanent</strong> and <strong>cannot be undone</strong>. Deleting your account will:</p>
            <ul>
              <li>Remove all your posts, comments, and reactions</li>
              <li>Delete all your direct messages</li>
              <li>Remove you from all communities</li>
              <li>Cancel any active mentorship connections</li>
              <li>Permanently erase your profile and all associated data</li>
            </ul>
          </div>

          <div class="w-confirm-box">
            <label class="w-confirm-label" for="confirm-input">
              To confirm, type <strong>DELETE</strong> below:
            </label>
            <input
              id="confirm-input"
              type="text"
              class="w-confirm-input"
              bind:value={confirmText}
              placeholder="Type DELETE to confirm"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          {#if error}
            <div class="w-delete-error">{error}</div>
          {/if}

          <button
            class="w-delete-btn"
            disabled={!canDelete || deleting}
            onclick={handleDelete}
          >
            {#if deleting}
              <span class="w-delete-spinner"></span>
              Deleting...
            {:else}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Permanently Delete My Account
            {/if}
          </button>

          <a href="/settings" class="w-cancel-link">Cancel and go back</a>
        </div>

      </div>
    </main>

    <!-- RIGHT SIDEBAR -->
    <aside class="w-sidebar-right">
      <div class="w-widget">
        <h3>Suggested Communities</h3>
        <a href="/wisers/communities" class="w-suggest-community">
          <div class="w-sc-icon" style="background:rgba(245,166,35,0.15);color:#f5a623">S</div>
          <div class="w-sc-info">
            <div class="w-sc-name">Side Hustle Hub</div>
            <div class="w-sc-members">1.2K members</div>
          </div>
        </a>
        <a href="/wisers/communities" class="w-suggest-community">
          <div class="w-sc-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6">T</div>
          <div class="w-sc-info">
            <div class="w-sc-name">Tech Builders</div>
            <div class="w-sc-members">890 members</div>
          </div>
        </a>
        <a href="/wisers/communities" class="w-suggest-community">
          <div class="w-sc-icon" style="background:rgba(16,185,129,0.15);color:#10b981">I</div>
          <div class="w-sc-info">
            <div class="w-sc-name">Investing 101</div>
            <div class="w-sc-members">2.1K members</div>
          </div>
        </a>
        <a href="/wisers/communities" class="w-suggest-community">
          <div class="w-sc-icon" style="background:rgba(167,139,250,0.15);color:#a78bfa">F</div>
          <div class="w-sc-info">
            <div class="w-sc-name">Freelancers United</div>
            <div class="w-sc-members">640 members</div>
          </div>
        </a>
      </div>
      <div class="w-widget w-footer">
        <a href="/">Scanner</a> · <a href="/seo">SEO</a> · <a href="/compare">Compare</a> · <a href="/support">Support</a>
        <div class="w-copyright">Balancewise Technologies &copy; 2026</div>
      </div>
    </aside>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

  :global([data-wisers-theme="light"]) { --wb: #ffffff; --wc: #f0f2f5; --wt: #1c1e21; --wt2: #606770; --wt3: #8a8d91; --wbd: #dddfe2; --wcard: #ffffff; --wgold: #d4a017; --whover: rgba(0,0,0,0.04); }

  .w { margin-top: 0; padding-top: 0; --wb: #0a0a0f; --wc: #111117; --wt: #e4e6ea; --wt2: #8a8d91; --wt3: #606770; --wbd: #1e1e2a; --wcard: #16161f; --wgold: #f5a623; --whover: rgba(255,255,255,0.04);
    font-family: 'DM Sans', -apple-system, sans-serif; color: var(--wt); background: var(--wb); min-height: 100vh; position: relative; }
  .w.light { --wb: #ffffff; --wc: #f0f2f5; --wt: #1c1e21; --wt2: #606770; --wt3: #8a8d91; --wbd: #dddfe2; --wcard: #ffffff; --wgold: #d4a017; --whover: rgba(0,0,0,0.04); }

  /* Topbar */
  .w-topbar { position: sticky; top: 0; z-index: 100; background: var(--wcard); border-bottom: 1px solid var(--wbd); height: 56px; }
  .w-topbar-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; height: 100%; padding: 0 16px; gap: 12px; }
  .w-logo { font-size: 24px; font-weight: 800; color: var(--wgold); text-decoration: none; letter-spacing: -1px; flex-shrink: 0; }
  .w-logo span { color: var(--wt); }
  .w-page-title { font-size: 16px; font-weight: 700; margin: 0; flex: 1; }
  .w-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .w-avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; text-decoration: none; flex-shrink: 0; }

  /* Three-column layout */
  .w-body { display: flex; max-width: 1280px; margin: 0 auto; min-height: calc(100vh - 56px); }

  /* Left sidebar */
  .w-sidebar-left { width: 240px; padding: 16px 12px; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; flex-shrink: 0; }
  .w-profile-card { display: flex; flex-direction: column; align-items: center; padding: 20px 12px; border-radius: 12px; background: var(--wcard); border: 1px solid var(--wbd); text-decoration: none; color: var(--wt); margin-bottom: 16px; }
  .w-profile-card:hover { border-color: var(--wgold); }
  .w-profile-name { font-weight: 700; font-size: 15px; margin-top: 10px; }
  .w-profile-handle { font-size: 12px; color: var(--wt2); }
  .w-avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex-shrink: 0; }
  .w-sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
  .w-sidebar-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: none; background: none; color: var(--wt2); font-size: 14px; font-weight: 500; cursor: pointer; width: 100%; text-align: left; text-decoration: none; font-family: inherit; }
  .w-sidebar-link:hover { background: var(--whover); color: var(--wt); }
  .w-sidebar-active { background: rgba(245,166,35,0.12) !important; color: var(--wgold) !important; font-weight: 600 !important; }
  .w-sidebar-divider { height: 1px; background: var(--wbd); margin: 12px 0; }
  .w-sidebar-back { font-size: 12px; color: var(--wt3); text-decoration: none; padding: 8px 12px; }
  .w-sidebar-back:hover { color: var(--wgold); }
  .w-count { font-size: 11px; padding: 1px 6px; border-radius: 99px; margin-left: auto; }

  /* Main content */
  .w-main { flex: 1; min-width: 0; border-left: 1px solid var(--wbd); border-right: 1px solid var(--wbd); }
  .w-delete-scroll { padding: 20px 24px; max-width: 560px; margin: 0 auto; }

  /* Back link */
  .w-back-link { display: inline-flex; align-items: center; gap: 6px; color: var(--wt2); font-size: 13px; font-weight: 600; text-decoration: none; margin-bottom: 20px; padding: 6px 0; }
  .w-back-link:hover { color: var(--wgold); }

  /* Delete card */
  .w-delete-card { background: var(--wcard); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 32px 28px; text-align: center; }
  .w-delete-icon { margin-bottom: 16px; }
  .w-delete-title { font-size: 22px; font-weight: 800; margin: 0 0 20px; color: #ef4444; }

  .w-delete-warning { text-align: left; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
  .w-delete-warning p { font-size: 13px; line-height: 1.6; margin: 0 0 10px; color: var(--wt2); }
  .w-delete-warning strong { color: var(--wt); }
  .w-delete-warning ul { margin: 0; padding-left: 18px; }
  .w-delete-warning li { font-size: 13px; line-height: 1.7; color: var(--wt3); }

  /* Confirm input */
  .w-confirm-box { margin-bottom: 20px; text-align: left; }
  .w-confirm-label { font-size: 13px; color: var(--wt2); margin-bottom: 8px; display: block; }
  .w-confirm-label strong { color: #ef4444; font-weight: 800; letter-spacing: 1px; }
  .w-confirm-input { width: 100%; padding: 12px 16px; border: 2px solid var(--wbd); border-radius: 8px; background: var(--wc); color: var(--wt); font-size: 16px; font-family: 'DM Sans', monospace; font-weight: 700; letter-spacing: 2px; text-align: center; outline: none; box-sizing: border-box; }
  .w-confirm-input:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
  .w-confirm-input::placeholder { color: var(--wt3); font-weight: 400; letter-spacing: 0; font-size: 14px; }

  /* Error message */
  .w-delete-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #fca5a5; text-align: left; }

  /* Delete button */
  .w-delete-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 24px; border-radius: 10px; border: none; background: #ef4444; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .w-delete-btn:hover:not(:disabled) { background: #dc2626; box-shadow: 0 4px 20px rgba(239,68,68,0.4); }
  .w-delete-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .w-delete-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Cancel link */
  .w-cancel-link { display: inline-block; margin-top: 16px; font-size: 13px; color: var(--wt3); text-decoration: none; }
  .w-cancel-link:hover { color: var(--wgold); text-decoration: underline; }

  /* Right sidebar */
  .w-sidebar-right { width: 280px; padding: 16px 12px; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; flex-shrink: 0; }

  .w-widget { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .w-widget h3 { font-size: 14px; font-weight: 700; margin: 0 0 12px; }

  .w-suggest-community { display: flex; align-items: center; gap: 10px; padding: 8px 0; text-decoration: none; color: var(--wt); }
  .w-suggest-community:hover .w-sc-name { color: var(--wgold); }
  .w-sc-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0; }
  .w-sc-info { flex: 1; min-width: 0; }
  .w-sc-name { font-size: 13px; font-weight: 600; transition: color 0.15s; }
  .w-sc-members { font-size: 11px; color: var(--wt3); }

  .w-footer { font-size: 11px; color: var(--wt3); }
  .w-footer a { color: var(--wt3); text-decoration: none; }
  .w-footer a:hover { color: var(--wgold); }
  .w-copyright { margin-top: 8px; font-size: 10px; }

  /* Responsive */
  @media (max-width: 1024px) {
    .w-sidebar-right { display: none; }
  }
  @media (max-width: 768px) {
    .w-sidebar-left { display: none; }
    .w-sidebar-right { display: none; }
    .w-main { border: none; }
    .w-delete-scroll { padding: 16px 12px; }
    .w-delete-card { padding: 24px 16px; }
    .w-page-title { font-size: 14px; }
  }
</style>
