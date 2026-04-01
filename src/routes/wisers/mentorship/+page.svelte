<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';

  let theme = $state<'dark'|'light'>('dark');
  let activeTab = $state<'browse'|'my-profile'|'requests'>('browse');
  let mentors = $state<any[]>([]);
  let myProfile = $state<any>(null);
  let requests = $state<any>({ incoming: [], outgoing: [] });
  let loading = $state(true);
  let browseRole = $state('mentor');
  let searchCat = $state('');

  // Profile form
  let formRole = $state('mentee');
  let formExpertise = $state('');
  let formLookingFor = $state('');
  let formLevel = $state('beginner');
  let formRevenue = $state('');
  let formMaxMentees = $state(3);
  let saving = $state(false);

  // Request
  let requestMsg = $state('');
  let requesting = $state('');

  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const revenueRanges = ['£0', '£0-500/mo', '£500-2k/mo', '£2k-5k/mo', '£5k-10k/mo', '£10k+/mo'];

  onMount(async () => {
    const saved = localStorage.getItem('wisers-theme');
    if (saved === 'light') { theme = 'light'; }
    else if (!saved && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) { theme = 'light'; }
    if (typeof document !== 'undefined') { document.documentElement.setAttribute('data-wisers-theme', theme); document.body.style.background = theme === 'light' ? '#ffffff' : '#0a0a0f'; }

    await Promise.all([loadMentors(), loadMyProfile(), loadRequests()]);
    loading = false;
  });

  async function loadMentors() {
    try { mentors = (await api.browseMentors(browseRole, searchCat)).profiles || []; } catch {}
  }
  async function loadMyProfile() {
    if (!$auth.token) return;
    try {
      const res = await api.getMyMentorshipProfile();
      myProfile = res.profile;
      if (myProfile) {
        formRole = myProfile.role; formExpertise = myProfile.expertise || '';
        formLookingFor = myProfile.looking_for || ''; formLevel = myProfile.experience_level || 'beginner';
        formRevenue = myProfile.monthly_revenue || ''; formMaxMentees = myProfile.max_mentees || 3;
      }
    } catch {}
  }
  async function loadRequests() {
    if (!$auth.token) return;
    try { requests = await api.getMentorshipRequests(); } catch {}
  }
  async function saveProfile() {
    saving = true;
    try {
      await api.saveMentorshipProfile({ role: formRole, expertise: formExpertise, looking_for: formLookingFor, experience_level: formLevel, monthly_revenue: formRevenue, max_mentees: formMaxMentees });
      await loadMyProfile();
    } catch {}
    saving = false;
  }
  async function sendRequest(username: string) {
    requesting = username;
    try { await api.requestMentorship(username, requestMsg); requestMsg = ''; await loadRequests(); } catch (e: any) { alert(e.message || 'Failed'); }
    requesting = '';
  }
  async function respond(id: number, action: string) {
    try { await api.respondMentorship(id, action); await loadRequests(); } catch {}
  }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
  function avatarSrc(url: string | null | undefined): string | null {
    if (!url || url === '') return null;
    if (url.startsWith('http')) return url;
    return 'https://api-bscan.balancewises.io/avatars/' + url;
  }
</script>

<svelte:head><title>Mentorship — Wisers</title></svelte:head>

<div class="mt" class:light={theme === 'light'}>
  <div class="mt-inner">
    <a href="/wisers" class="mt-back">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Feed
    </a>

    <h1 class="mt-title">Mentorship</h1>
    <p class="mt-sub">Find a mentor or become one. Connect with people who've been where you are.</p>

    <div class="mt-bar">
      <div class="mt-tabs">
        <button class:active={activeTab === 'browse'} onclick={() => { activeTab = 'browse'; loadMentors(); }}>Browse</button>
        <button class:active={activeTab === 'my-profile'} onclick={() => activeTab = 'my-profile'}>My Profile</button>
        {#if $auth.token}
          <button class:active={activeTab === 'requests'} onclick={() => { activeTab = 'requests'; loadRequests(); }}>
            Requests
            {#if requests.incoming.length > 0}<span class="mt-badge">{requests.incoming.length}</span>{/if}
          </button>
        {/if}
      </div>
    </div>

    {#if activeTab === 'browse'}
      <div class="mt-browse-bar">
        <div class="mt-role-toggle">
          <button class:active={browseRole === 'mentor'} onclick={() => { browseRole = 'mentor'; loadMentors(); }}>Find Mentors</button>
          <button class:active={browseRole === 'mentee'} onclick={() => { browseRole = 'mentee'; loadMentors(); }}>Find Mentees</button>
        </div>
      </div>

      {#if loading}
        <div class="mt-empty">Loading...</div>
      {:else if mentors.length === 0}
        <div class="mt-empty">No {browseRole}s available yet. Create your profile to be listed.</div>
      {:else}
        <div class="mt-grid">
          {#each mentors as m}
            <div class="mt-card">
              <div class="mt-card-top">
                <div class="mt-avatar">{#if avatarSrc(m.avatar_url)}<img src={avatarSrc(m.avatar_url)} alt="" />{:else}{initial(m.display_name || m.username)}{/if}</div>
                <div class="mt-card-info">
                  <a href="/wisers/{m.username}" class="mt-card-name">{m.display_name || m.username}</a>
                  <div class="mt-card-handle">@{m.username}</div>
                </div>
                <span class="mt-level-badge">{m.experience_level}</span>
              </div>
              {#if m.bio}<p class="mt-card-bio">{m.bio}</p>{/if}
              {#if m.expertise}
                <div class="mt-card-section">
                  <span class="mt-card-label">Expertise</span>
                  <span>{m.expertise}</span>
                </div>
              {/if}
              {#if m.looking_for}
                <div class="mt-card-section">
                  <span class="mt-card-label">Looking for</span>
                  <span>{m.looking_for}</span>
                </div>
              {/if}
              {#if m.monthly_revenue}
                <div class="mt-card-section">
                  <span class="mt-card-label">Revenue</span>
                  <span>{m.monthly_revenue}</span>
                </div>
              {/if}
              <div class="mt-card-actions">
                {#if $auth.token && m.user_id !== $auth.user?.id}
                  <button class="mt-request-btn" onclick={() => sendRequest(m.username)} disabled={requesting === m.username}>
                    {requesting === m.username ? 'Sending...' : 'Request'}
                  </button>
                  <a href="/wisers/messages?user={m.username}" class="mt-msg-btn">Message</a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

    {:else if activeTab === 'my-profile'}
      <div class="mt-profile-form">
        <div class="mt-form-card">
          <h3>{myProfile ? 'Edit your mentorship profile' : 'Create your mentorship profile'}</h3>
          <p class="mt-form-hint">This determines how you appear in search and what kind of connections you attract.</p>

          <div class="mt-field">
            <label for="mt-role">I want to be a</label>
            <div class="mt-role-selector">
              <button class:active={formRole === 'mentor'} onclick={() => formRole = 'mentor'} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
                Mentor
              </button>
              <button class:active={formRole === 'mentee'} onclick={() => formRole = 'mentee'} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                Mentee
              </button>
              <button class:active={formRole === 'both'} onclick={() => formRole = 'both'} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Both
              </button>
            </div>
          </div>

          <div class="mt-field">
            <label for="mt-level">Experience level</label>
            <div class="mt-level-pills">
              {#each levels as lvl}
                <button class="mt-pill" class:active={formLevel === lvl} onclick={() => formLevel = lvl} type="button">{lvl}</button>
              {/each}
            </div>
          </div>

          <div class="mt-field">
            <label for="mt-expertise">Your expertise</label>
            <textarea id="mt-expertise" bind:value={formExpertise} rows="2" placeholder="e.g. Ecommerce, SEO, SaaS, Dropshipping, Content Marketing"></textarea>
          </div>

          <div class="mt-field">
            <label for="mt-looking">What are you looking for?</label>
            <textarea id="mt-looking" bind:value={formLookingFor} rows="2" placeholder="e.g. Someone who's built a £10k/mo ecommerce store"></textarea>
          </div>

          <div class="mt-field">
            <label for="mt-revenue">Monthly revenue (optional)</label>
            <select id="mt-revenue" bind:value={formRevenue}>
              <option value="">Prefer not to say</option>
              {#each revenueRanges as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </div>

          {#if formRole === 'mentor' || formRole === 'both'}
            <div class="mt-field">
              <label for="mt-max">Max mentees</label>
              <input id="mt-max" type="number" bind:value={formMaxMentees} min="1" max="20" />
            </div>
          {/if}

          <button class="mt-save-btn" onclick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : myProfile ? 'Update Profile' : 'Create Profile'}
          </button>
        </div>
      </div>

    {:else}
      <div class="mt-requests">
        {#if requests.incoming.length > 0}
          <h3 class="mt-req-heading">Incoming Requests</h3>
          {#each requests.incoming as req}
            <div class="mt-req-card">
              <div class="mt-req-top">
                <div class="mt-avatar-sm">{#if avatarSrc(req.avatar_url)}<img src={avatarSrc(req.avatar_url)} alt="" />{:else}{initial(req.display_name || req.username)}{/if}</div>
                <div class="mt-req-info">
                  <a href="/wisers/{req.username}" class="mt-req-name">{req.display_name || req.username}</a>
                  <div class="mt-req-handle">@{req.username}</div>
                </div>
              </div>
              {#if req.message}<p class="mt-req-msg">"{req.message}"</p>{/if}
              <div class="mt-req-actions">
                <button class="mt-accept-btn" onclick={() => respond(req.id, 'accept')}>Accept</button>
                <button class="mt-decline-btn" onclick={() => respond(req.id, 'decline')}>Decline</button>
              </div>
            </div>
          {/each}
        {/if}

        {#if requests.outgoing.length > 0}
          <h3 class="mt-req-heading">Sent Requests</h3>
          {#each requests.outgoing as req}
            <div class="mt-req-card">
              <div class="mt-req-top">
                <div class="mt-avatar-sm">{#if avatarSrc(req.avatar_url)}<img src={avatarSrc(req.avatar_url)} alt="" />{:else}{initial(req.display_name || req.username)}{/if}</div>
                <div class="mt-req-info">
                  <a href="/wisers/{req.username}" class="mt-req-name">{req.display_name || req.username}</a>
                  <span class="mt-req-status" class:active={req.status === 'active'} class:pending={req.status === 'pending'} class:declined={req.status === 'declined'}>{req.status}</span>
                </div>
              </div>
            </div>
          {/each}
        {/if}

        {#if requests.incoming.length === 0 && requests.outgoing.length === 0}
          <div class="mt-empty">No mentorship requests yet.</div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .mt { width: 100%; min-height: 100vh; margin: 0; padding: 0;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--mt-t); background: var(--mt-bg);
    --mt-bg: #0a0a0f; --mt-card: #111117; --mt-t: #e4e6ea; --mt-t2: #8a8d91; --mt-t3: #606770; --mt-bd: #1e1e2a; --mt-gold: #f5a623; }
  .mt.light { --mt-bg: #fff; --mt-card: #fff; --mt-t: #1c1e21; --mt-t2: #606770; --mt-t3: #8a8d91; --mt-bd: #dddfe2; --mt-gold: #d4a017; }
  :global(body) { margin: 0; }
  :global(.page) { padding: 0 !important; }
  .mt-inner { max-width: 800px; margin: 0 auto; padding: 40px 48px; }
  .mt-back { font-size: 13px; color: var(--mt-gold); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .mt-back:hover { text-decoration: underline; }
  .mt-title { font-size: 28px; font-weight: 600; margin: 0 0 6px; }
  .mt-sub { font-size: 15px; color: var(--mt-t3); margin: 0 0 28px; }
  .mt-bar { border-bottom: 1px solid var(--mt-bd); margin-bottom: 24px; }
  .mt-tabs { display: flex; gap: 0; }
  .mt-tabs button { background: none; border: none; padding: 12px 20px; font-size: 14px; font-weight: 500; color: var(--mt-t3); border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px; }
  .mt-tabs button.active { color: var(--mt-gold); border-bottom-color: var(--mt-gold); }
  .mt-badge { background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }
  .mt-browse-bar { display: flex; gap: 10px; margin-bottom: 20px; }
  .mt-role-toggle { display: flex; gap: 4px; background: var(--mt-card); border: 1px solid var(--mt-bd); border-radius: 12px; padding: 4px; }
  .mt-role-toggle button { background: none; border: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--mt-t3); cursor: pointer; font-family: inherit; }
  .mt-role-toggle button.active { background: var(--mt-gold); color: #000; }
  .mt-empty { text-align: center; color: var(--mt-t3); padding: 60px 20px; font-size: 15px; }
  .mt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .mt-card { background: var(--mt-card); border: 1px solid var(--mt-bd); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .mt-card:hover { border-color: var(--mt-t3); }
  .mt-card-top { display: flex; align-items: center; gap: 12px; }
  .mt-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--mt-gold), #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; font-size: 18px; flex-shrink: 0; overflow: hidden; }
  .mt-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .mt-card-info { flex: 1; min-width: 0; }
  .mt-card-name { font-weight: 600; font-size: 15px; color: var(--mt-t); text-decoration: none; }
  .mt-card-name:hover { color: var(--mt-gold); }
  .mt-card-handle { font-size: 13px; color: var(--mt-t3); }
  .mt-level-badge { font-size: 11px; color: var(--mt-gold); border: 1px solid rgba(245,166,35,0.3); padding: 3px 10px; border-radius: 12px; text-transform: capitalize; font-weight: 500; flex-shrink: 0; }
  .mt-card-bio { font-size: 13px; color: var(--mt-t2); line-height: 1.5; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .mt-card-section { font-size: 13px; color: var(--mt-t2); }
  .mt-card-label { color: var(--mt-t3); font-weight: 500; margin-right: 6px; }
  .mt-card-actions { display: flex; gap: 8px; margin-top: 4px; }
  .mt-request-btn { background: var(--mt-gold); color: #000; border: none; padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .mt-request-btn:disabled { opacity: 0.5; }
  .mt-msg-btn { background: none; border: 1px solid var(--mt-bd); color: var(--mt-t2); padding: 8px 18px; border-radius: 20px; font-size: 13px; text-decoration: none; font-family: inherit; }
  .mt-msg-btn:hover { border-color: var(--mt-t3); color: var(--mt-t); }

  /* Profile form */
  .mt-profile-form { max-width: 560px; }
  .mt-form-card { background: var(--mt-card); border: 1px solid var(--mt-bd); border-radius: 16px; padding: 24px; }
  .mt-form-card h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; }
  .mt-form-hint { font-size: 13px; color: var(--mt-t3); margin: 0 0 20px; }
  .mt-field { margin-bottom: 18px; display: flex; flex-direction: column; gap: 6px; }
  .mt-field label { font-size: 13px; font-weight: 500; color: var(--mt-t2); }
  .mt-field textarea, .mt-field select, .mt-field input { background: var(--mt-bg); border: 1px solid var(--mt-bd); border-radius: 10px; padding: 10px 14px; color: var(--mt-t); font-size: 14px; font-family: inherit; resize: vertical; }
  .mt-field textarea:focus, .mt-field select:focus, .mt-field input:focus { outline: none; border-color: var(--mt-gold); }
  .mt-role-selector { display: flex; gap: 8px; }
  .mt-role-selector button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px; border: 1.5px solid var(--mt-bd); border-radius: 12px; background: none; color: var(--mt-t3); cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; }
  .mt-role-selector button.active { border-color: var(--mt-gold); color: var(--mt-gold); background: rgba(245,166,35,0.06); }
  .mt-level-pills { display: flex; gap: 6px; }
  .mt-pill { padding: 7px 16px; border-radius: 20px; font-size: 13px; border: 1px solid var(--mt-bd); background: none; color: var(--mt-t3); cursor: pointer; font-family: inherit; text-transform: capitalize; }
  .mt-pill.active { background: rgba(245,166,35,0.12); color: var(--mt-gold); border-color: transparent; }
  .mt-save-btn { background: var(--mt-gold); color: #000; border: none; padding: 10px 28px; border-radius: 24px; font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit; }
  .mt-save-btn:disabled { opacity: 0.4; }

  /* Requests */
  .mt-requests { display: flex; flex-direction: column; gap: 12px; }
  .mt-req-heading { font-size: 15px; font-weight: 600; color: var(--mt-gold); margin: 8px 0; }
  .mt-req-card { background: var(--mt-card); border: 1px solid var(--mt-bd); border-radius: 14px; padding: 16px; }
  .mt-req-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .mt-avatar-sm { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--mt-gold), #e09100); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #000; font-size: 16px; flex-shrink: 0; overflow: hidden; }
  .mt-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
  .mt-req-info { flex: 1; }
  .mt-req-name { font-weight: 600; font-size: 14px; color: var(--mt-t); text-decoration: none; }
  .mt-req-name:hover { color: var(--mt-gold); }
  .mt-req-handle { font-size: 12px; color: var(--mt-t3); }
  .mt-req-msg { font-size: 13px; color: var(--mt-t2); font-style: italic; margin: 0 0 8px; }
  .mt-req-status { font-size: 11px; padding: 3px 10px; border-radius: 10px; text-transform: capitalize; font-weight: 500; }
  .mt-req-status.active { color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
  .mt-req-status.pending { color: var(--mt-gold); border: 1px solid rgba(245,166,35,0.3); }
  .mt-req-status.declined { color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
  .mt-req-actions { display: flex; gap: 8px; }
  .mt-accept-btn { background: #10b981; color: #fff; border: none; padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .mt-decline-btn { background: none; border: 1px solid var(--mt-bd); color: var(--mt-t3); padding: 8px 18px; border-radius: 20px; font-size: 13px; cursor: pointer; font-family: inherit; }
  .mt-decline-btn:hover { border-color: #ef4444; color: #ef4444; }

  @media (max-width: 640px) { .mt-inner { padding: 20px 16px; } .mt-grid { grid-template-columns: 1fr; } .mt-role-selector { flex-direction: column; } }
</style>
