<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';
  import { auth } from '$lib/stores/auth';

  let profile = $state<any>(null);
  let posts = $state<any[]>([]);
  let status = $state('');
  let loading = $state(true);
  let error = $state('');
  let actionMsg = $state('');
  let activeTab = $state('posts');
  let editing = $state(false);
  let followStatus = $state<{ i_follow: boolean; they_follow: boolean }>({ i_follow: false, they_follow: false });
  let followersCount = $state(0);
  let followingCount = $state(0);
  let isBlocked = $state(false);
  let editData = $state<any>({});
  let saving = $state(false);

  $effect(() => { const u = $page.params.username; if (u) loadProfile(u); });

  async function loadProfile(username: string) {
    loading = true; error = '';
    try {
      profile = await api.getCommunityProfile(username);
      if ($auth.token) { 
        status = (await api.getFriendshipStatus(username).catch(() => ({ status: 'none' }))).status;
        if (status !== 'self') {
          try { followStatus = await api.getFollowStatus(username); } catch {}
          try { followersCount = (await api.getFollowers(username)).count || 0; } catch {}
          try { followingCount = (await api.getFollowing(username)).count || 0; } catch {}
        }
      }
      try { posts = (await api.getUserPosts(username)).posts || []; } catch {}
    } catch (e: any) { error = e.message || 'User not found'; }
    loading = false;
  }

  async function addFriend() {
    try { const r = await api.sendFriendRequest(profile.username); actionMsg = r.message; status = r.status === 'accepted' ? 'friends' : 'request_sent'; } catch (e: any) { actionMsg = e.message; }
    setTimeout(() => actionMsg = '', 3000);
  }
  async function removeFriend() { if (!confirm('Unfriend?')) return; await api.unfriend(profile.username); status = 'none'; }

  function startEdit() {
    editData = { bio: profile.bio || '', headline: profile.headline || '', company: profile.company || '', website: profile.website || '',
      skills: profile.skills || '', work_history: profile.work_history || '', education: profile.education || '',
      certifications: profile.certifications || '', languages: profile.languages || '', interests: profile.interests || '',
      github_url: profile.github_url || '', linkedin_url: profile.linkedin_url || '', twitter_url: profile.twitter_url || '' };
    editing = true;
  }
  async function saveProfile() {
    saving = true;
    try {
      await api.updateProfile($auth.user?.email || '', editData);
      Object.assign(profile, editData);
      editing = false; actionMsg = 'Saved!';
    } catch { actionMsg = 'Failed'; }
    saving = false; setTimeout(() => actionMsg = '', 3000);
  }

  function avatarSrc(url: string | null): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : 'https://api-bscan.balancewises.io/avatars/' + url;
  }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
  function timeAgo(d: string) { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return 'now'; if (s < 3600) return Math.floor(s/60) + 'm'; if (s < 86400) return Math.floor(s/3600) + 'h'; return Math.floor(s/86400) + 'd'; }
  function planColor(p: string) { return p === 'agency' ? '#f5a623' : p === 'pro' ? '#3b82f6' : '#555'; }
  function parseList(s: string) { return (s || '').split(',').map(i => i.trim()).filter(Boolean); }
  function parseEntries(s: string) { return (s || '').split('\n').filter(l => l.trim()); }

  const badge = '<svg viewBox="0 0 22 22" width="18" height="18"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.635-.08 1.293.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.604-.274 1.26-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44s1.167.551 1.813.568c.645-.017 1.27-.213 1.81-.567.54-.355.97-.854 1.244-1.44.607.223 1.264.27 1.897.14.634-.131 1.218-.437 1.687-.883.445-.47.75-1.054.882-1.69.13-.635.083-1.292-.14-1.896.587-.274 1.084-.705 1.438-1.246.355-.54.552-1.17.57-1.817z"/><path d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="white"/></svg>';

  async function handleFollow() {
    if (!$auth.token || !profileData) return;
    try {
      if (followStatus.i_follow) {
        await api.unfollowUser(profileData.username);
        followStatus = { ...followStatus, i_follow: false };
        followersCount = Math.max(0, followersCount - 1);
      } else {
        await api.followUser(profileData.username);
        followStatus = { ...followStatus, i_follow: true };
        followersCount += 1;
      }
    } catch {}
  }

  async function handleBlock() {
    if (!$auth.token || !profileData) return;
    if (confirm('Block @' + profileData.username + '? This will unfriend and prevent interaction.')) {
      try {
        await api.blockUser(profileData.username);
        isBlocked = true;
      } catch {}
    }
  }

  async function handleMute() {
    if (!$auth.token || !profileData) return;
    try {
      await api.muteUser(profileData.username);
      alert('Muted @' + profileData.username);
    } catch {}
  }
</script>

<svelte:head>
  <title>{profile?.username ? '@' + profile.username + ' — Wisers' : 'Profile'}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  {#if profile}<meta property="og:title" content="@{profile.username} on Wisers" /><meta name="robots" content="index, follow" />{/if}
</svelte:head>

<div class="pr">
{#if loading}<div class="pr-center"><div class="pr-spin"></div></div>
{:else if error}<div class="pr-center"><p>{error}</p><a href="/wisers">Back to Wisers</a></div>
{:else if profile}

  <div class="pr-banner"></div>

  <div class="pr-wrap">
    <div class="pr-top">
      <div class="pr-av">{#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}{initial(profile.display_name || profile.name)}{/if}</div>
      <div class="pr-top-right">
        {#if $auth.token && status === 'self'}
          <button class="pr-btn pr-btn-o" onclick={startEdit}>Edit profile</button>
          <a href="/account" class="pr-btn pr-btn-o">Settings</a>
        {:else if $auth.token}
          {#if status === 'friends'}<a href="/wisers/messages" class="pr-btn pr-btn-o">Message</a><button class="pr-btn pr-btn-g" onclick={removeFriend}>Friends ✓</button>
          {:else if status === 'request_sent'}<button class="pr-btn pr-btn-o" disabled>Pending</button>
          {:else}<button class="pr-btn pr-btn-p" onclick={addFriend}>Connect</button>{/if}
        {/if}
      </div>
    </div>

    {#if editing}
      <div class="pr-edit">
        <h3>Edit Profile</h3>
        <div class="pr-edit-grid">
          <div class="pr-edit-field"><label>Headline</label><input bind:value={editData.headline} placeholder="e.g. Full Stack Developer | Founder" /></div>
          <div class="pr-edit-field"><label>Bio</label><textarea bind:value={editData.bio} rows="3" placeholder="Tell your story..."></textarea></div>
          <div class="pr-edit-field"><label>Company</label><input bind:value={editData.company} placeholder="Where you work" /></div>
          <div class="pr-edit-field"><label>Website</label><input bind:value={editData.website} placeholder="https://..." /></div>
          <div class="pr-edit-field"><label>Skills (comma-separated)</label><input bind:value={editData.skills} placeholder="JavaScript, Python, SEO, Leadership" /></div>
          <div class="pr-edit-field"><label>Work History (one per line)</label><textarea bind:value={editData.work_history} rows="4" placeholder="Software Engineer at Google (2020-2023)&#10;Intern at Meta (2019)"></textarea></div>
          <div class="pr-edit-field"><label>Education (one per line)</label><textarea bind:value={editData.education} rows="3" placeholder="BSc Computer Science — MIT (2020)&#10;A-Levels — Westminster School (2016)"></textarea></div>
          <div class="pr-edit-field"><label>Certifications (one per line)</label><textarea bind:value={editData.certifications} rows="2" placeholder="AWS Solutions Architect&#10;Google Analytics Certified"></textarea></div>
          <div class="pr-edit-field"><label>Languages (comma-separated)</label><input bind:value={editData.languages} placeholder="English, French, Mandarin" /></div>
          <div class="pr-edit-field"><label>Interests (comma-separated)</label><input bind:value={editData.interests} placeholder="AI, Web3, Startups, Football" /></div>
          <div class="pr-edit-row">
            <div class="pr-edit-field"><label>GitHub</label><input bind:value={editData.github_url} placeholder="https://github.com/you" /></div>
            <div class="pr-edit-field"><label>LinkedIn</label><input bind:value={editData.linkedin_url} placeholder="https://linkedin.com/in/you" /></div>
            <div class="pr-edit-field"><label>X / Twitter</label><input bind:value={editData.twitter_url} placeholder="https://x.com/you" /></div>
          </div>
        </div>
        <div class="pr-edit-btns">
          <button class="pr-btn pr-btn-p" onclick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button class="pr-btn pr-btn-o" onclick={() => editing = false}>Cancel</button>
        </div>
      </div>
    {:else}
      <div class="pr-identity">
        <div class="pr-name-row"><h1>{profile.display_name || profile.name}</h1><span class="pr-badge" style="fill:{planColor(profile.plan)}">{@html badge}</span></div>
        <div class="pr-handle">@{profile.username}</div>
        {#if profile.headline}<div class="pr-headline">{profile.headline}</div>{/if}
        {#if profile.bio}<p class="pr-bio">{profile.bio}</p>{/if}

        <div class="pr-meta">
          {#if profile.company}<span>🏢 {profile.company}</span>{/if}
          {#if profile.city || profile.country}<span>📍 {[profile.city, profile.country].filter(Boolean).join(', ')}</span>{/if}
          {#if profile.website}<a href={profile.website} target="_blank" rel="noopener">🔗 {profile.website.replace(/https?:\/\//, '')}</a>{/if}
          <span>📅 Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
        </div>

        <div class="pr-socials">
          {#if profile.github_url}<a href={profile.github_url} target="_blank" rel="noopener" class="pr-social">GitHub</a>{/if}
          {#if profile.linkedin_url}<a href={profile.linkedin_url} target="_blank" rel="noopener" class="pr-social">LinkedIn</a>{/if}
          {#if profile.twitter_url}<a href={profile.twitter_url} target="_blank" rel="noopener" class="pr-social">X</a>{/if}
        </div>
        {#if actionMsg}<div class="pr-toast">{actionMsg}</div>{/if}
      </div>

      <div class="pr-stats">
        <div><strong>{profile.stats?.total_scans || 0}</strong> Scans</div>
        <div><strong>{profile.stats?.avg_score || 0}</strong> Avg</div>
        <div><strong>{profile.stats?.friends || 0}</strong> Friends</div>
        <div><strong>{posts.length}</strong> Posts</div>
      </div>

      <!-- Skills -->
      {#if parseList(profile.skills).length > 0}
        <div class="pr-section">
          <h3>Skills</h3>
          <div class="pr-tags">{#each parseList(profile.skills) as skill}<span class="pr-tag">{skill}</span>{/each}</div>
        </div>
      {/if}

      <!-- Work -->
      {#if parseEntries(profile.work_history).length > 0}
        <div class="pr-section">
          <h3>Experience</h3>
          {#each parseEntries(profile.work_history) as entry}<div class="pr-entry"><span class="pr-entry-dot"></span><div>{entry}</div></div>{/each}
        </div>
      {/if}

      <!-- Education -->
      {#if parseEntries(profile.education).length > 0}
        <div class="pr-section">
          <h3>Education</h3>
          {#each parseEntries(profile.education) as entry}<div class="pr-entry"><span class="pr-entry-dot ed"></span><div>{entry}</div></div>{/each}
        </div>
      {/if}

      <!-- Certifications -->
      {#if parseEntries(profile.certifications).length > 0}
        <div class="pr-section">
          <h3>Certifications</h3>
          {#each parseEntries(profile.certifications) as cert}<div class="pr-entry"><span class="pr-entry-dot cert"></span><div>{cert}</div></div>{/each}
        </div>
      {/if}

      <!-- Languages -->
      {#if parseList(profile.languages).length > 0}
        <div class="pr-section">
          <h3>Languages</h3>
          <div class="pr-tags">{#each parseList(profile.languages) as lang}<span class="pr-tag lang">{lang}</span>{/each}</div>
        </div>
      {/if}

      <!-- Interests -->
      {#if parseList(profile.interests).length > 0}
        <div class="pr-section">
          <h3>Interests</h3>
          <div class="pr-tags">{#each parseList(profile.interests) as i}<span class="pr-tag int">{i}</span>{/each}</div>
        </div>
      {/if}

      <!-- Tabs -->
      <div class="pr-tabs">
        <button class="pr-tab" class:active={activeTab === 'posts'} onclick={() => activeTab = 'posts'}>Posts</button>
        <button class="pr-tab" class:active={activeTab === 'scans'} onclick={() => activeTab = 'scans'}>Activity</button>
      </div>

      {#if activeTab === 'posts'}
        {#if posts.length === 0}<div class="pr-empty">No posts yet</div>
        {:else}{#each posts as post}
          <div class="pr-post">
            <div class="pr-post-head">
              <div class="pr-post-av">{#if avatarSrc(profile.avatar_url)}<img src={avatarSrc(profile.avatar_url)} alt="" />{:else}{initial(profile.display_name || profile.name)}{/if}</div>
              <div><span class="pr-post-name">{profile.display_name || profile.name}</span> <span class="pr-post-h">@{profile.username} · {timeAgo(post.created_at)}</span></div>
            </div>
            <div class="pr-post-body">{post.content}</div>
            <div class="pr-post-ft"><span>❤️ {post.likes_count || 0}</span><span>💬 {post.comments_count || 0}</span></div>
          </div>
        {/each}{/if}
      {:else}
        <div class="pr-empty"><strong>{profile.stats?.total_scans || 0}</strong> scans · avg score <strong>{profile.stats?.avg_score || 0}</strong>  <div class="pr-follow-stats">
          <span><strong>{followersCount}</strong> followers</span>
          <span><strong>{followingCount}</strong> following</span>
        </div>
      </div>
      {/if}
    {/if}
  </div>
{/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .pr { --bg:#0a0a0f;--card:#111117;--t1:#e4e6ea;--t2:#8a8d91;--t3:#606770;--bd:#1e1e2a;--gold:#f5a623;--hv:rgba(255,255,255,0.04);
    font-family:'DM Sans',-apple-system,sans-serif;color:var(--t1);background:var(--bg);min-height:100vh; }
  .pr-banner { height:200px;background:linear-gradient(135deg,#1a1a2e,#16213e 40%,#0f3460 70%,#1a1a2e);position:relative; }
  .pr-banner::after { content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,var(--bg) 100%); }
  .pr-wrap { max-width:680px;margin:0 auto;padding:0 20px 60px; }
  .pr-top { display:flex;justify-content:space-between;align-items:flex-start;margin-top:-60px;position:relative;z-index:2; }
  .pr-av { width:120px;height:120px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:42px;border:4px solid var(--bg);overflow:hidden;flex-shrink:0; }
  .pr-av img { width:100%;height:100%;object-fit:cover; }
  .pr-top-right { padding-top:72px;display:flex;gap:8px; }
  .pr-btn { padding:8px 20px;border-radius:20px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;border:none;text-decoration:none;display:inline-flex;align-items:center;gap:6px; }
  .pr-btn-p { background:var(--gold);color:#000; } .pr-btn-p:hover { filter:brightness(1.1); }
  .pr-btn-o { background:transparent;border:1px solid var(--bd);color:var(--t1); } .pr-btn-o:hover { border-color:var(--t2); }
  .pr-btn-g { border:1px solid #10b981;color:#10b981;background:transparent; }
  .pr-btn:disabled { opacity:0.4;cursor:default; }

  .pr-identity { margin-top:14px; }
  .pr-name-row { display:flex;align-items:center;gap:6px; }
  .pr-name-row h1 { font-size:24px;font-weight:800;margin:0; }
  .pr-badge { display:inline-flex; }
  .pr-handle { font-size:15px;color:var(--t2); }
  .pr-headline { font-size:15px;color:var(--t1);margin-top:6px;font-weight:500; }
  .pr-bio { font-size:14px;line-height:1.6;margin-top:10px;white-space:pre-wrap;color:var(--t2); }
  .pr-meta { display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:13px;color:var(--t2); }
  .pr-meta a { color:var(--gold);text-decoration:none; } .pr-meta a:hover { text-decoration:underline; }
  .pr-socials { display:flex;gap:8px;margin-top:10px; }
  .pr-social { padding:4px 12px;border-radius:14px;font-size:11px;font-weight:700;border:1px solid var(--bd);color:var(--t2);text-decoration:none; }
  .pr-social:hover { border-color:var(--gold);color:var(--gold); }
  .pr-toast { margin-top:8px;font-size:12px;color:#10b981; }

  .pr-stats { display:flex;gap:24px;margin-top:16px;padding:16px 0;border-bottom:1px solid var(--bd);font-size:14px;color:var(--t2); }
  .pr-stats strong { color:var(--t1);font-weight:800;margin-right:3px; }

  /* Sections */
  .pr-section { margin-top:20px;padding:20px;background:var(--card);border:1px solid var(--bd);border-radius:14px; }
  .pr-section h3 { font-size:16px;font-weight:800;margin:0 0 12px; }
  .pr-tags { display:flex;flex-wrap:wrap;gap:6px; }
  .pr-tag { padding:4px 12px;border-radius:14px;font-size:12px;font-weight:600;background:rgba(245,166,35,0.08);color:var(--gold);border:1px solid rgba(245,166,35,0.15); }
  .pr-tag.lang { background:rgba(59,130,246,0.08);color:#3b82f6;border-color:rgba(59,130,246,0.15); }
  .pr-tag.int { background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.15); }
  .pr-entry { display:flex;align-items:flex-start;gap:10px;padding:8px 0;font-size:14px;line-height:1.5; }
  .pr-entry-dot { width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:6px; }
  .pr-entry-dot.ed { background:#3b82f6; }
  .pr-entry-dot.cert { background:#10b981; }

  /* Edit form */
  .pr-edit { margin-top:16px;padding:24px;background:var(--card);border:1px solid var(--bd);border-radius:14px; }
  .pr-edit h3 { font-size:18px;font-weight:800;margin:0 0 16px; }
  .pr-edit-grid { display:flex;flex-direction:column;gap:12px; }
  .pr-edit-field { display:flex;flex-direction:column;gap:4px; }
  .pr-edit-field label { font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.05em; }
  .pr-edit-field input, .pr-edit-field textarea { padding:10px 14px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--t1);font-size:14px;font-family:inherit;outline:none;resize:vertical; }
  .pr-edit-field input:focus, .pr-edit-field textarea:focus { border-color:var(--gold); }
  .pr-edit-row { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px; }
  .pr-edit-btns { display:flex;gap:8px;margin-top:16px; }

  /* Tabs */
  .pr-tabs { display:flex;border-bottom:1px solid var(--bd);margin-top:20px; }
  .pr-tab { flex:1;padding:14px 0;text-align:center;font-size:14px;font-weight:600;color:var(--t2);background:none;border:none;cursor:pointer;border-bottom:3px solid transparent;font-family:inherit; }
  .pr-tab:hover { background:var(--hv); } .pr-tab.active { color:var(--gold);border-bottom-color:var(--gold); }

  .pr-empty { padding:40px;text-align:center;color:var(--t3);font-size:14px; }
  .pr-post { padding:16px 0;border-bottom:1px solid var(--bd); }
  .pr-post-head { display:flex;align-items:center;gap:10px;margin-bottom:8px; }
  .pr-post-av { width:36px;height:36px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;overflow:hidden;flex-shrink:0; }
  .pr-post-av img { width:100%;height:100%;object-fit:cover; }
  .pr-post-name { font-weight:700;font-size:14px; } .pr-post-h { font-size:13px;color:var(--t2);margin-left:4px; }
  .pr-post-body { font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-word; }
  .pr-post-ft { display:flex;gap:20px;margin-top:10px;font-size:13px;color:var(--t2); }

  .pr-center { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px;color:var(--t3); }
  .pr-center a { color:var(--gold);text-decoration:none; }
  .pr-spin { width:28px;height:28px;border:3px solid var(--bd);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media(max-width:600px) { .pr-banner{height:140px} .pr-av{width:90px;height:90px;font-size:32px} .pr-top{margin-top:-45px} .pr-top-right{padding-top:52px} .pr-name-row h1{font-size:20px} .pr-edit-row{grid-template-columns:1fr} }
  .pr-follow-btn { background: var(--wgold) !important; color: #000 !important; font-weight: 700; }
  .pr-follow-btn.following { background: transparent !important; color: var(--wt2) !important; border: 1px solid var(--wbd); }
  .pr-follow-btn.following:hover { border-color: #ef4444; color: #ef4444 !important; }
  .pr-follow-stats { display: flex; gap: 16px; margin-top: 12px; font-size: 14px; color: var(--wt2); }
  .pr-follow-stats strong { color: var(--wt); font-weight: 700; }
  .pr-btn-mute { background: transparent !important; border: 1px solid var(--wbd) !important; color: var(--wt3) !important; font-size: 12px !important; }
  .pr-btn-block { background: transparent !important; border: 1px solid rgba(239,68,68,0.3) !important; color: #ef4444 !important; font-size: 12px !important; }
</style>