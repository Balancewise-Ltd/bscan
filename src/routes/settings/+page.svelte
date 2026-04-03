<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { wsNotifCount, wsUnreadDMs } from '$lib/stores/wisers-ws';
  import { page } from '$app/stores';

  let theme = $state<'dark' | 'light'>('dark');

  /* Profile settings */
  let displayName = $state('');
  let bio = $state('');
  let username = $state('');

  /* Notification toggles */
  let notifLikes = $state(true);
  let notifComments = $state(true);
  let notifFriendReqs = $state(true);
  let notifMessages = $state(true);
  let notifEmail = $state(false);

  /* Privacy settings */
  let whoCanMessage = $state<'everyone' | 'friends' | 'nobody'>('everyone');
  let profileVisibility = $state<'public' | 'friends'>('public');
  let showActivityStatus = $state(true);

  let saving = $state(false);
  let toast = $state('');
  let toastTimer: any = null;

  const currentPath = $derived($page.url.pathname);

  function showToast(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast = ''; }, 2500);
  }

  onMount(() => {
    document.body.classList.add('wisers-page');
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; document.documentElement.setAttribute('data-wisers-theme', 'light'); }

    if ($auth.user) {
      displayName = $auth.user.name || '';
      bio = ($auth.user as any).bio || '';
      username = $auth.user.username || '';
    }

    return () => { document.body.classList.remove('wisers-page'); };
  });

  async function saveProfile() {
    saving = true;
    try {
      /* In a real implementation, this would call the API */
      await new Promise(r => setTimeout(r, 600));
      showToast('Profile updated');
    } catch {
      showToast('Failed to save');
    }
    saving = false;
  }

  async function saveNotifications() {
    showToast('Notification preferences saved');
  }

  async function savePrivacy() {
    showToast('Privacy settings saved');
  }

  function initial(name: string) {
    return (name || '?').charAt(0).toUpperCase();
  }
</script>

<svelte:head>
  <title>Settings - Wisers</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="w" class:light={theme === 'light'}>
  <!-- TOP BAR -->
  <header class="w-topbar">
    <div class="w-topbar-inner">
      <a href="/wisers" class="w-logo">W<span>isers</span></a>
      <h1 class="w-page-title">Settings</h1>
      <div class="w-topbar-right">
        {#if $auth.user}
          <a href="/wisers/{$auth.user.username || 'me'}" class="w-avatar-sm" title="Profile">
            {initial($auth.user.name || $auth.user.email)}
          </a>
        {:else}
          <a href="/account" class="w-login-btn">Join Wisers</a>
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
      <div class="w-settings-scroll">

        <!-- PROFILE SECTION -->
        <section class="w-settings-section">
          <div class="w-section-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h2>Profile</h2>
          </div>
          <div class="w-form-group">
            <label class="w-label" for="s-name">Display Name</label>
            <input id="s-name" type="text" class="w-input" bind:value={displayName} placeholder="Your name" />
          </div>
          <div class="w-form-group">
            <label class="w-label" for="s-username">Username</label>
            <div class="w-input-prefix">
              <span class="w-prefix">@</span>
              <input id="s-username" type="text" class="w-input w-input-with-prefix" bind:value={username} placeholder="username" />
            </div>
          </div>
          <div class="w-form-group">
            <label class="w-label" for="s-bio">Bio</label>
            <textarea id="s-bio" class="w-textarea" bind:value={bio} placeholder="Tell the community about yourself..." rows="3"></textarea>
            <div class="w-char-count">{bio.length}/160</div>
          </div>
          <div class="w-form-group">
            <label class="w-label">Avatar</label>
            <div class="w-avatar-upload">
              <div class="w-avatar-preview">{initial(displayName || 'U')}</div>
              <button class="w-upload-btn">Change avatar</button>
            </div>
          </div>
          <button class="w-save-btn" onclick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </section>

        <!-- NOTIFICATIONS SECTION -->
        <section class="w-settings-section">
          <div class="w-section-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <h2>Notifications</h2>
          </div>
          <div class="w-toggle-row">
            <div class="w-toggle-info">
              <div class="w-toggle-label">Likes</div>
              <div class="w-toggle-desc">Get notified when someone likes your post</div>
            </div>
            <button class="w-toggle" class:on={notifLikes} onclick={() => notifLikes = !notifLikes} role="switch" aria-checked={notifLikes}>
              <div class="w-toggle-knob"></div>
            </button>
          </div>
          <div class="w-toggle-row">
            <div class="w-toggle-info">
              <div class="w-toggle-label">Comments</div>
              <div class="w-toggle-desc">Get notified when someone comments on your post</div>
            </div>
            <button class="w-toggle" class:on={notifComments} onclick={() => notifComments = !notifComments} role="switch" aria-checked={notifComments}>
              <div class="w-toggle-knob"></div>
            </button>
          </div>
          <div class="w-toggle-row">
            <div class="w-toggle-info">
              <div class="w-toggle-label">Friend Requests</div>
              <div class="w-toggle-desc">Get notified when someone sends you a friend request</div>
            </div>
            <button class="w-toggle" class:on={notifFriendReqs} onclick={() => notifFriendReqs = !notifFriendReqs} role="switch" aria-checked={notifFriendReqs}>
              <div class="w-toggle-knob"></div>
            </button>
          </div>
          <div class="w-toggle-row">
            <div class="w-toggle-info">
              <div class="w-toggle-label">Messages</div>
              <div class="w-toggle-desc">Get notified for new direct messages</div>
            </div>
            <button class="w-toggle" class:on={notifMessages} onclick={() => notifMessages = !notifMessages} role="switch" aria-checked={notifMessages}>
              <div class="w-toggle-knob"></div>
            </button>
          </div>
          <div class="w-toggle-row">
            <div class="w-toggle-info">
              <div class="w-toggle-label">Email Notifications</div>
              <div class="w-toggle-desc">Receive a daily email digest of activity</div>
            </div>
            <button class="w-toggle" class:on={notifEmail} onclick={() => notifEmail = !notifEmail} role="switch" aria-checked={notifEmail}>
              <div class="w-toggle-knob"></div>
            </button>
          </div>
          <button class="w-save-btn" onclick={saveNotifications}>Save Notifications</button>
        </section>

        <!-- PRIVACY SECTION -->
        <section class="w-settings-section">
          <div class="w-section-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <h2>Privacy</h2>
          </div>
          <div class="w-form-group">
            <label class="w-label" for="s-messaging">Who can message you</label>
            <select id="s-messaging" class="w-select" bind:value={whoCanMessage}>
              <option value="everyone">Everyone</option>
              <option value="friends">Friends only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>
          <div class="w-form-group">
            <label class="w-label" for="s-visibility">Profile visibility</label>
            <select id="s-visibility" class="w-select" bind:value={profileVisibility}>
              <option value="public">Public</option>
              <option value="friends">Friends only</option>
            </select>
          </div>
          <div class="w-toggle-row">
            <div class="w-toggle-info">
              <div class="w-toggle-label">Show activity status</div>
              <div class="w-toggle-desc">Let others see when you're online</div>
            </div>
            <button class="w-toggle" class:on={showActivityStatus} onclick={() => showActivityStatus = !showActivityStatus} role="switch" aria-checked={showActivityStatus}>
              <div class="w-toggle-knob"></div>
            </button>
          </div>
          <button class="w-save-btn" onclick={savePrivacy}>Save Privacy</button>
        </section>

        <!-- DANGER ZONE -->
        <section class="w-settings-section w-danger-section">
          <div class="w-section-header w-danger-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h2>Danger Zone</h2>
          </div>
          <p class="w-danger-text">Once you delete your account, there is no going back. All your posts, connections, and data will be permanently removed.</p>
          <a href="/settings/delete-account" class="w-danger-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete Account
          </a>
        </section>

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

{#if toast}
  <div class="w-toast">{toast}</div>
{/if}

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
  .w-login-btn { padding: 7px 16px; border-radius: 8px; background: var(--wgold); color: #000; font-weight: 700; font-size: 13px; text-decoration: none; white-space: nowrap; }

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
  .w-settings-scroll { padding: 20px 24px; max-width: 640px; }

  /* Settings sections */
  .w-settings-section { background: var(--wcard); border: 1px solid var(--wbd); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .w-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--wbd); }
  .w-section-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .w-section-header svg { color: var(--wgold); flex-shrink: 0; }

  /* Form inputs */
  .w-form-group { margin-bottom: 16px; }
  .w-label { display: block; font-size: 12px; font-weight: 600; color: var(--wt2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .w-input { width: 100%; padding: 10px 14px; border: 1px solid var(--wbd); border-radius: 8px; background: var(--wc); color: var(--wt); font-size: 14px; font-family: inherit; outline: none; box-sizing: border-box; }
  .w-input:focus { border-color: var(--wgold); box-shadow: 0 0 0 2px rgba(245,166,35,0.15); }
  .w-input-prefix { display: flex; align-items: center; border: 1px solid var(--wbd); border-radius: 8px; background: var(--wc); overflow: hidden; }
  .w-input-prefix:focus-within { border-color: var(--wgold); box-shadow: 0 0 0 2px rgba(245,166,35,0.15); }
  .w-prefix { padding: 10px 0 10px 14px; color: var(--wt3); font-size: 14px; font-weight: 600; }
  .w-input-with-prefix { border: none; background: transparent; padding-left: 4px; }
  .w-input-with-prefix:focus { box-shadow: none; }
  .w-textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--wbd); border-radius: 8px; background: var(--wc); color: var(--wt); font-size: 14px; font-family: inherit; outline: none; resize: vertical; box-sizing: border-box; }
  .w-textarea:focus { border-color: var(--wgold); box-shadow: 0 0 0 2px rgba(245,166,35,0.15); }
  .w-char-count { font-size: 11px; color: var(--wt3); text-align: right; margin-top: 4px; }
  .w-select { width: 100%; padding: 10px 14px; border: 1px solid var(--wbd); border-radius: 8px; background: var(--wc); color: var(--wt); font-size: 14px; font-family: inherit; outline: none; cursor: pointer; appearance: auto; }
  .w-select:focus { border-color: var(--wgold); box-shadow: 0 0 0 2px rgba(245,166,35,0.15); }

  /* Avatar upload */
  .w-avatar-upload { display: flex; align-items: center; gap: 14px; }
  .w-avatar-preview { width: 56px; height: 56px; border-radius: 50%; background: var(--wgold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; flex-shrink: 0; }
  .w-upload-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--wbd); background: none; color: var(--wt2); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .w-upload-btn:hover { border-color: var(--wgold); color: var(--wgold); }

  /* Toggle switches */
  .w-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
  .w-toggle-row:last-of-type { border-bottom: none; }
  .w-toggle-info { flex: 1; min-width: 0; }
  .w-toggle-label { font-size: 14px; font-weight: 600; }
  .w-toggle-desc { font-size: 12px; color: var(--wt3); margin-top: 2px; }
  .w-toggle { width: 44px; height: 24px; border-radius: 12px; border: none; background: var(--wbd); cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; padding: 0; }
  .w-toggle.on { background: var(--wgold); }
  .w-toggle-knob { width: 18px; height: 18px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .w-toggle.on .w-toggle-knob { transform: translateX(20px); }

  /* Save button */
  .w-save-btn { padding: 10px 24px; border-radius: 20px; border: none; background: var(--wgold); color: #000; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; margin-top: 16px; }
  .w-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .w-save-btn:hover:not(:disabled) { filter: brightness(1.1); }

  /* Danger zone */
  .w-danger-section { border-color: rgba(239,68,68,0.3); }
  .w-danger-header h2 { color: #ef4444; }
  .w-danger-text { font-size: 13px; color: var(--wt3); margin: 0 0 16px; line-height: 1.5; }
  .w-danger-link { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #ef4444; background: rgba(239,68,68,0.08); color: #ef4444; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.15s; }
  .w-danger-link:hover { background: #ef4444; color: #fff; }

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

  /* Toast */
  .w-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--wgold, #f5a623); color: #000; padding: 10px 24px; border-radius: 20px; font-weight: 700; font-size: 13px; z-index: 200; animation: slideUp 0.3s; font-family: 'DM Sans', -apple-system, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

  /* Responsive */
  @media (max-width: 1024px) {
    .w-sidebar-right { display: none; }
  }
  @media (max-width: 768px) {
    .w-sidebar-left { display: none; }
    .w-sidebar-right { display: none; }
    .w-main { border: none; }
    .w-settings-scroll { padding: 16px 12px; }
    .w-page-title { font-size: 14px; }
  }
</style>
