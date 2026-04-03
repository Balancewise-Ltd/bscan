<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';

  let { onfinish }: { onfinish: () => void } = $props();

  let step = $state(1);
  let username = $state('');
  let dob = $state('');
  let bio = $state('');
  let avatarFile = $state<File | null>(null);
  let avatarPreview = $state('');
  let usernameOk = $state<boolean | null>(null);
  let usernameChecking = $state(false);
  let saving = $state(false);
  let error = $state('');
  let suggestedUsers = $state<any[]>([]);
  let followedUsers = $state<Set<string>>(new Set());
  let interests = $state<Set<string>>(new Set());

  const categories = [
    'Side Hustle', 'E-Commerce', 'Investing', 'Tech', 'Freelance',
    'SaaS', 'Crypto', 'Property', 'Content Creation', 'Careers', 'FIRE', 'Students'
  ];

  let checkTimer: any;
  function onUsernameInput() {
    usernameOk = null;
    error = '';
    clearTimeout(checkTimer);
    if (username.length < 3) return;
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { error = 'Letters, numbers, underscores only'; return; }
    usernameChecking = true;
    checkTimer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(username);
        usernameOk = res.available;
        if (!res.available) error = 'Username taken';
      } catch { usernameOk = false; error = 'Check failed'; }
      usernameChecking = false;
    }, 400);
  }

  function handleAvatarSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { error = 'File too large (max 20MB)'; return; }
    avatarFile = file;
    avatarPreview = URL.createObjectURL(file);
  }

  async function saveUsername() {
    if (!username || username.length < 3 || !usernameOk) return;
    saving = true; error = '';
    try {
      await api.updateProfile($auth.user?.email || '', { username });
      step = 2;
    } catch (e: any) { error = e.message || e.detail || 'Failed to save'; }
    saving = false;
  }

  function validateDob(): boolean {
    if (!dob) { error = 'Date of birth is required'; return false; }
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    if (age < 13) { error = 'You must be at least 13 years old to use Wisers'; return false; }
    return true;
  }

  async function saveDob() {
    error = '';
    if (!validateDob()) return;
    saving = true;
    try {
      await api.updateProfile($auth.user?.email || '', { date_of_birth: dob });
      step = 3;
    } catch (e: any) { error = e.message || e.detail || 'Failed to save'; }
    saving = false;
  }

  async function saveAvatar() {
    saving = true; error = '';
    try {
      if (avatarFile) await api.uploadAvatar(avatarFile);
      step = 4;
    } catch (e: any) { error = e.message || e.detail || 'Upload failed'; }
    saving = false;
  }

  async function saveBio() {
    saving = true; error = '';
    try {
      if (bio.trim()) await api.updateProfile($auth.user?.email || '', { bio });
      if (interests.size > 0) await api.updateUserSettings({ interests: [...interests] });
      step = 5;
      loadSuggested();
    } catch (e: any) { error = e.message || e.detail || 'Failed to save'; }
    saving = false;
  }

  async function loadSuggested() {
    try {
      const res = await api.searchWisers('a');
      suggestedUsers = (res.users || []).filter((u: any) => u.username !== $auth.user?.username).slice(0, 12);
    } catch {}
  }

  async function toggleFollow(uname: string) {
    if (followedUsers.has(uname)) {
      try { await api.unfollowUser(uname); followedUsers.delete(uname); followedUsers = new Set(followedUsers); } catch {}
    } else {
      try { await api.followUser(uname); followedUsers.add(uname); followedUsers = new Set(followedUsers); } catch {}
    }
  }

  function toggleInterest(cat: string) {
    if (interests.has(cat)) interests.delete(cat); else interests.add(cat);
    interests = new Set(interests);
  }

  function finish() {
    localStorage.setItem('wisers-onboarded', '1');
    auth.refresh();
    onfinish();
  }

  function initial(name: string) {
    return (name || '?')[0].toUpperCase();
  }
</script>

<div class="ob-overlay">
  <div class="ob-card">
    <!-- Progress bar -->
    <div class="ob-progress">
      <div class="ob-progress-fill" style="width: {(step / 5) * 100}%"></div>
    </div>

    {#if step === 1}
      <div class="ob-step">
        <div class="ob-icon">W</div>
        <h2>Welcome to Wisers</h2>
        <p class="ob-subtitle">The social platform for wealth builders. Let's set up your profile.</p>
        <label class="ob-label">Choose your username</label>
        <div class="ob-input-wrap">
          <span class="ob-at">@</span>
          <input type="text" class="ob-input" placeholder="username" bind:value={username} oninput={onUsernameInput} maxlength="30" />
          {#if usernameChecking}
            <span class="ob-check loading">...</span>
          {:else if usernameOk === true}
            <span class="ob-check ok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          {:else if usernameOk === false}
            <span class="ob-check bad">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          {/if}
        </div>
        {#if error}<p class="ob-error">{error}</p>{/if}
        <button class="ob-btn" onclick={saveUsername} disabled={saving || !usernameOk || username.length < 3}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>

    {:else if step === 2}
      <div class="ob-step">
        <h2>When's your birthday?</h2>
        <p class="ob-subtitle">This won't be shown publicly. We need this to make sure you're old enough to use Wisers.</p>
        <label class="ob-label">Date of birth</label>
        <input type="date" class="ob-input ob-date-input" bind:value={dob} max={new Date().toISOString().split('T')[0]} style="color-scheme:dark" />
        {#if error}<p class="ob-error">{error}</p>{/if}
        <button class="ob-btn" onclick={saveDob} disabled={saving || !dob}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>

    {:else if step === 3}
      <div class="ob-step">
        <h2>Add a profile photo</h2>
        <p class="ob-subtitle">Help people recognise you in the community.</p>
        <label class="ob-avatar-upload">
          {#if avatarPreview}
            <img src={avatarPreview} alt="Preview" class="ob-avatar-img" />
          {:else}
            <div class="ob-avatar-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>Upload photo</span>
            </div>
          {/if}
          <input type="file" accept="image/*" onchange={handleAvatarSelect} hidden />
        </label>
        {#if error}<p class="ob-error">{error}</p>{/if}
        <div class="ob-btn-row">
          <button class="ob-btn secondary" onclick={() => { step = 4; loadSuggested(); }}>Skip</button>
          <button class="ob-btn" onclick={saveAvatar} disabled={saving}>
            {saving ? 'Uploading...' : avatarFile ? 'Continue' : 'Skip'}
          </button>
        </div>
      </div>

    {:else if step === 4}
      <div class="ob-step">
        <h2>Tell us about yourself</h2>
        <p class="ob-subtitle">What are you building? What are your goals?</p>
        <textarea class="ob-textarea" placeholder="I'm building..." bind:value={bio} maxlength="500"></textarea>
        <label class="ob-label">What interests you?</label>
        <div class="ob-tags">
          {#each categories as cat}
            <button class="ob-tag" class:active={interests.has(cat)} onclick={() => toggleInterest(cat)}>{cat}</button>
          {/each}
        </div>
        {#if error}<p class="ob-error">{error}</p>{/if}
        <div class="ob-btn-row">
          <button class="ob-btn secondary" onclick={() => { step = 5; loadSuggested(); }}>Skip</button>
          <button class="ob-btn" onclick={saveBio} disabled={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>

    {:else if step === 5}
      <div class="ob-step">
        <h2>Follow some wisers</h2>
        <p class="ob-subtitle">See what the community is building.</p>
        {#if suggestedUsers.length > 0}
          <div class="ob-users">
            {#each suggestedUsers as u}
              <div class="ob-user-row">
                <div class="ob-user-av">{#if u.avatar_url}<img src={u.avatar_url} alt="" />{:else}{initial(u.display_name || u.name)}{/if}</div>
                <div class="ob-user-info">
                  <span class="ob-user-name">{u.display_name || u.name}</span>
                  <span class="ob-user-handle">@{u.username}</span>
                </div>
                <button class="ob-follow-btn" class:following={followedUsers.has(u.username)} onclick={() => toggleFollow(u.username)}>
                  {followedUsers.has(u.username) ? 'Following' : 'Follow'}
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="ob-muted">Loading suggestions...</p>
        {/if}
        <button class="ob-btn ob-finish-btn" onclick={finish}>
          {followedUsers.size > 0 ? "Let's go!" : 'Skip & finish'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .ob-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    padding: 16px;
    animation: obFadeIn 0.3s ease-out;
  }
  @keyframes obFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

  .ob-card {
    background: #111117; border: 1px solid #1e1e2a; border-radius: 20px;
    width: 100%; max-width: 440px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  :global([data-wisers-theme="light"]) .ob-card { background: #ffffff; border-color: #dddfe2; }

  .ob-progress { height: 3px; background: #1e1e2a; }
  :global([data-wisers-theme="light"]) .ob-progress { background: #dddfe2; }
  .ob-progress-fill { height: 100%; background: #f5a623; border-radius: 2px; transition: width 0.3s ease; }

  .ob-step { padding: 32px 28px; text-align: center; }
  .ob-step h2 { font-size: 22px; font-weight: 800; color: #e4e6ea; margin: 0 0 6px; }
  :global([data-wisers-theme="light"]) .ob-step h2 { color: #1c1e21; }
  .ob-subtitle { font-size: 14px; color: #8a8d91; margin: 0 0 24px; }
  .ob-icon { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #f5a623, #e09100); color: #000; font-weight: 900; font-size: 28px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }

  .ob-label { display: block; text-align: left; font-size: 12px; font-weight: 600; color: #8a8d91; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ob-input-wrap { display: flex; align-items: center; background: #0a0a0f; border: 1px solid #1e1e2a; border-radius: 12px; padding: 0 12px; margin-bottom: 8px; }
  :global([data-wisers-theme="light"]) .ob-input-wrap { background: #f0f2f5; border-color: #dddfe2; }
  .ob-at { color: #f5a623; font-weight: 700; font-size: 16px; }
  .ob-input { flex: 1; background: none; border: none; color: #e4e6ea; font-size: 16px; padding: 12px 8px; outline: none; font-family: 'DM Sans', sans-serif; }
  :global([data-wisers-theme="light"]) .ob-input { color: #1c1e21; }
  .ob-input::placeholder { color: #606770; }
  .ob-check { display: flex; align-items: center; }
  .ob-check.loading { color: #8a8d91; font-size: 14px; }
  .ob-date-input { width: 100%; background: #0a0a0f; border: 1px solid #1e1e2a; border-radius: 12px; padding: 12px; color: #e4e6ea; font-size: 16px; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 8px; box-sizing: border-box; }
  :global([data-wisers-theme="light"]) .ob-date-input { background: #f0f2f5; border-color: #dddfe2; color: #1c1e21; color-scheme: light; }
  .ob-date-input:focus { border-color: #f5a623; }
  .ob-error { color: #ef4444; font-size: 12px; margin: 4px 0 12px; text-align: left; }

  .ob-btn {
    width: 100%; padding: 12px; border: none; border-radius: 12px;
    background: #f5a623; color: #000; font-weight: 700; font-size: 15px;
    cursor: pointer; font-family: 'DM Sans', sans-serif; margin-top: 8px;
    transition: opacity 0.15s;
  }
  .ob-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ob-btn:hover:not(:disabled) { opacity: 0.9; }
  .ob-btn.secondary { background: none; border: 1px solid #1e1e2a; color: #8a8d91; }
  :global([data-wisers-theme="light"]) .ob-btn.secondary { border-color: #dddfe2; color: #606770; }
  .ob-btn-row { display: flex; gap: 10px; margin-top: 12px; }
  .ob-btn-row .ob-btn { flex: 1; }

  .ob-avatar-upload { display: block; cursor: pointer; margin: 0 auto 20px; }
  .ob-avatar-img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #f5a623; display: block; margin: 0 auto; }
  .ob-avatar-placeholder {
    width: 120px; height: 120px; border-radius: 50%; margin: 0 auto;
    border: 2px dashed #1e1e2a; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 6px;
    color: #606770; font-size: 12px; transition: border-color 0.15s;
  }
  .ob-avatar-placeholder:hover { border-color: #f5a623; color: #f5a623; }
  :global([data-wisers-theme="light"]) .ob-avatar-placeholder { border-color: #dddfe2; }

  .ob-textarea {
    width: 100%; min-height: 80px; padding: 12px; border: 1px solid #1e1e2a;
    border-radius: 12px; background: #0a0a0f; color: #e4e6ea;
    font-size: 14px; font-family: 'DM Sans', sans-serif; resize: vertical;
    outline: none; margin-bottom: 16px;
  }
  :global([data-wisers-theme="light"]) .ob-textarea { background: #f0f2f5; border-color: #dddfe2; color: #1c1e21; }
  .ob-textarea:focus { border-color: #f5a623; }
  .ob-textarea::placeholder { color: #606770; }

  .ob-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; justify-content: center; }
  .ob-tag {
    padding: 6px 14px; border-radius: 20px; border: 1px solid #1e1e2a;
    background: none; color: #8a8d91; font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
  }
  .ob-tag:hover { border-color: #f5a623; color: #f5a623; }
  .ob-tag.active { background: rgba(245,166,35,0.15); border-color: #f5a623; color: #f5a623; }
  :global([data-wisers-theme="light"]) .ob-tag { border-color: #dddfe2; }

  .ob-users { max-height: 320px; overflow-y: auto; margin-bottom: 16px; }
  .ob-user-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid #1e1e2a; }
  :global([data-wisers-theme="light"]) .ob-user-row { border-color: #dddfe2; }
  .ob-user-row:last-child { border-bottom: none; }
  .ob-user-av {
    width: 40px; height: 40px; border-radius: 50%; background: #f5a623;
    color: #000; font-weight: 800; font-size: 15px; display: flex;
    align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
  }
  .ob-user-av img { width: 100%; height: 100%; object-fit: cover; }
  .ob-user-info { flex: 1; min-width: 0; text-align: left; }
  .ob-user-name { display: block; font-size: 14px; font-weight: 600; color: #e4e6ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global([data-wisers-theme="light"]) .ob-user-name { color: #1c1e21; }
  .ob-user-handle { font-size: 12px; color: #8a8d91; }
  .ob-follow-btn {
    padding: 6px 16px; border-radius: 20px; border: 1px solid #f5a623;
    background: none; color: #f5a623; font-size: 12px; font-weight: 700;
    cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap;
    transition: all 0.15s;
  }
  .ob-follow-btn:hover { background: #f5a623; color: #000; }
  .ob-follow-btn.following { background: transparent; border-color: #1e1e2a; color: #8a8d91; }
  .ob-follow-btn.following:hover { border-color: #ef4444; color: #ef4444; }
  .ob-finish-btn { margin-top: 0; }
  .ob-muted { color: #606770; font-size: 13px; }

  @media (max-width: 480px) {
    .ob-card { border-radius: 16px; }
    .ob-step { padding: 24px 20px; }
    .ob-step h2 { font-size: 20px; }
    .ob-avatar-img, .ob-avatar-placeholder { width: 100px; height: 100px; }
  }
</style>
