<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';

  let communities = $state<any[]>([]);
  let myCommunities = $state<any[]>([]);
  let loading = $state(true);
  let search = $state('');
  let activeTab = $state<'discover'|'mine'>('discover');
  let activeCategory = $state('all');
  let showCreate = $state(false);
  let newName = $state('');
  let newDesc = $state('');
  let newCategory = $state('general');
  let newRules = $state('');
  let creating = $state(false);

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'tech', label: 'Tech' },
    { key: 'ecommerce', label: 'Ecommerce' },
    { key: 'investing', label: 'Investing' },
    { key: 'freelance', label: 'Freelance' },
    { key: 'side-hustle', label: 'Side Hustle' },
    { key: 'saas', label: 'SaaS' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'property', label: 'Property' },
    { key: 'content-creation', label: 'Content' },
    { key: 'careers', label: 'Careers' },
    { key: 'fire', label: 'FIRE' },
    { key: 'students', label: 'Students' },
  ];

  const categoryIcons: Record<string, { svg: string; bg: string; stroke: string }> = {
    'side-hustle': { svg: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', bg: 'rgba(245,158,11,0.12)', stroke: '#f59e0b' },
    'ecommerce': { svg: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>', bg: 'rgba(14,116,144,0.15)', stroke: '#0e7490' },
    'investing': { svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', bg: 'rgba(16,185,129,0.12)', stroke: '#10b981' },
    'tech': { svg: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>', bg: 'rgba(124,58,237,0.12)', stroke: '#7c3aed' },
    'freelance': { svg: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>', bg: 'rgba(239,68,68,0.1)', stroke: '#ef4444' },
    'saas': { svg: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>', bg: 'rgba(59,130,246,0.12)', stroke: '#3b82f6' },
    'crypto': { svg: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', bg: 'rgba(234,179,8,0.12)', stroke: '#eab308' },
    'property': { svg: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', bg: 'rgba(168,85,247,0.12)', stroke: '#a855f7' },
    'content-creation': { svg: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>', bg: 'rgba(236,72,153,0.12)', stroke: '#ec4899' },
    'careers': { svg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>', bg: 'rgba(34,197,94,0.12)', stroke: '#22c55e' },
    'fire': { svg: '<path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z"/>', bg: 'rgba(249,115,22,0.12)', stroke: '#f97316' },
    'students': { svg: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>', bg: 'rgba(6,182,212,0.12)', stroke: '#06b6d4' },
    'general': { svg: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', bg: 'rgba(148,163,184,0.12)', stroke: '#94a3b8' },
  };

  function getIcon(cat: string) { return categoryIcons[cat] || categoryIcons['general']; }

  onMount(async () => {
    await Promise.all([loadCommunities(), loadMine()]);
    loading = false;
  });

  async function loadCommunities() {
    try {
      const cat = activeCategory === 'all' ? '' : activeCategory;
      communities = (await api.getCommunities(1, cat, search)).communities || [];
    } catch {}
  }

  async function loadMine() {
    if (!$auth.token) return;
    try { myCommunities = (await api.getMyCommunities()).communities || []; } catch {}
  }

  async function filterCategory(key: string) {
    activeCategory = key;
    await loadCommunities();
  }

  async function handleSearch() { await loadCommunities(); }

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    creating = true;
    try {
      await api.createCommunity({ name: newName, description: newDesc, category: newCategory, rules: newRules });
      showCreate = false; newName = ''; newDesc = ''; newCategory = 'general'; newRules = '';
      await Promise.all([loadCommunities(), loadMine()]);
    } catch (e: any) { alert(e.message || 'Failed to create community'); }
    creating = false;
  }

  async function handleJoin(e: Event, slug: string) {
    e.preventDefault();
    e.stopPropagation();
    try { await api.joinCommunity(slug); await Promise.all([loadCommunities(), loadMine()]); } catch {}
  }

  function isMember(id: number) { return myCommunities.some(m => m.id === id); }
  function formatCat(c: string) { return c.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
</script>

<svelte:head><title>Communities — Wisers</title></svelte:head>

<div class="cp">
  <a href="/wisers" class="cp-back">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    Feed
  </a>

  <h1 class="cp-title">Communities</h1>
  <p class="cp-sub">Find your people. Join the conversation.</p>

  <div class="cp-bar">
    <div class="cp-tabs">
      <button class:active={activeTab === 'discover'} onclick={() => { activeTab = 'discover'; loadCommunities(); }}>Discover</button>
      <button class:active={activeTab === 'mine'} onclick={() => { activeTab = 'mine'; loadMine(); }}>My communities</button>
    </div>
    {#if $auth.token}
      <button class="cp-create-btn" onclick={() => showCreate = !showCreate}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create
      </button>
    {/if}
  </div>

  {#if showCreate}
    <div class="cp-modal-overlay" onclick={() => showCreate = false} role="presentation">
      <div class="cp-modal" onclick={(e) => e.stopPropagation()} role="dialog">
        <div class="cp-modal-header">
          <h2>Create a community</h2>
          <button class="cp-modal-close" onclick={() => showCreate = false} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="cp-modal-body">
          <div class="cp-field">
            <label for="cp-name">Name</label>
            <input id="cp-name" type="text" bind:value={newName} placeholder="e.g. Side Hustle Beginners" maxlength="100" />
          </div>
          <div class="cp-field">
            <label for="cp-desc">Description</label>
            <textarea id="cp-desc" bind:value={newDesc} placeholder="What's this community about?" maxlength="500" rows="3"></textarea>
          </div>
          <div class="cp-field">
            <label for="cp-cat">Category</label>
            <select id="cp-cat" bind:value={newCategory}>
              {#each categories.filter(c => c.key !== 'all') as cat}
                <option value={cat.key}>{cat.label}</option>
              {/each}
            </select>
          </div>
          <div class="cp-field">
            <label for="cp-rules">Rules (optional)</label>
            <textarea id="cp-rules" bind:value={newRules} placeholder="Community guidelines..." maxlength="2000" rows="3"></textarea>
          </div>
        </div>
        <div class="cp-modal-footer">
          <button class="cp-cancel" onclick={() => showCreate = false}>Cancel</button>
          <button class="cp-submit" onclick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Creating...' : 'Create Community'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if activeTab === 'discover'}
    <div class="cp-cats">
      {#each categories as cat}
        <button class="cp-cat-pill" class:active={activeCategory === cat.key} onclick={() => filterCategory(cat.key)}>{cat.label}</button>
      {/each}
    </div>

    <div class="cp-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" bind:value={search} placeholder="Search communities..." oninput={handleSearch} />
    </div>

    {#if loading}
      <div class="cp-empty">Loading communities...</div>
    {:else if communities.length === 0}
      <div class="cp-empty">No communities found. Be the first to create one.</div>
    {:else}
      <div class="cp-grid">
        {#each communities as c}
          {@const icon = getIcon(c.category)}
          <a href="/wisers/communities/{c.slug}" class="cp-card">
            <div class="cp-card-top">
              <div class="cp-card-icon" style="background:{icon.bg}">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="{icon.stroke}" stroke-width="1.6">{@html icon.svg}</svg>
              </div>
              <div class="cp-card-info">
                <div class="cp-card-name">{c.name}</div>
                <div class="cp-card-cat">{formatCat(c.category)}</div>
              </div>
            </div>
            <p class="cp-card-desc">{c.description || 'No description yet.'}</p>
            <div class="cp-card-bottom">
              <div class="cp-card-stats">
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {c.member_count}
                </span>
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {c.post_count}
                </span>
              </div>
              {#if $auth.token}
                {#if isMember(c.id)}
                  <span class="cp-joined-badge">Joined</span>
                {:else}
                  <button class="cp-join-btn" onclick={(e) => handleJoin(e, c.slug)}>Join</button>
                {/if}
              {/if}
            </div>
          </a>
        {/each}
        {#if $auth.token}
          <button class="cp-card cp-card-create" onclick={() => showCreate = true}>
            <div class="cp-create-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div class="cp-create-label">Create a community</div>
            <div class="cp-create-sub">Start something new</div>
          </button>
        {/if}
      </div>
    {/if}

  {:else}
    {#if myCommunities.length === 0}
      <div class="cp-empty">You haven't joined any communities yet. Discover some above.</div>
    {:else}
      <div class="cp-grid">
        {#each myCommunities as c}
          {@const icon = getIcon(c.category)}
          <a href="/wisers/communities/{c.slug}" class="cp-card">
            <div class="cp-card-top">
              <div class="cp-card-icon" style="background:{icon.bg}">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="{icon.stroke}" stroke-width="1.6">{@html icon.svg}</svg>
              </div>
              <div class="cp-card-info">
                <div class="cp-card-name">{c.name}</div>
                <div class="cp-card-cat">{formatCat(c.category)} · <span class="cp-role">{c.role}</span></div>
              </div>
            </div>
            <p class="cp-card-desc">{c.description || ''}</p>
            <div class="cp-card-bottom">
              <div class="cp-card-stats">
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {c.member_count}
                </span>
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {c.post_count}
                </span>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .cp { max-width: 900px; margin: 0 auto; padding: 40px 48px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e4e4e9; min-height: 100vh; }
  .cp-back { font-size: 13px; color: #f59e0b; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .cp-back:hover { text-decoration: underline; }
  .cp-title { font-size: 28px; font-weight: 600; margin: 0 0 6px; }
  .cp-sub { font-size: 15px; color: #4b5563; margin: 0 0 28px; }

  /* Tabs */
  .cp-bar { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1c2538; margin-bottom: 24px; }
  .cp-tabs { display: flex; gap: 0; }
  .cp-tabs button { background: none; border: none; padding: 12px 20px; font-size: 14px; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; }
  .cp-tabs button.active { color: #f59e0b; border-bottom-color: #f59e0b; }
  .cp-tabs button:hover { color: #e4e4e9; }
  .cp-create-btn { background: #f59e0b; color: #0c1220; border: none; padding: 9px 20px; border-radius: 24px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; margin-bottom: 2px; }
  .cp-create-btn:hover { background: #d97706; }

  /* Category pills */
  .cp-cats { display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
  .cp-cats::-webkit-scrollbar { display: none; }
  .cp-cat-pill { padding: 7px 16px; border-radius: 20px; font-size: 13px; font-weight: 500; color: #6b7280; border: 1px solid #1c2538; background: none; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .cp-cat-pill.active { background: rgba(245,158,11,0.12); color: #f59e0b; border-color: transparent; }
  .cp-cat-pill:hover { color: #e4e4e9; border-color: #2a3548; }

  /* Search */
  .cp-search { display: flex; align-items: center; gap: 10px; background: #111827; border: 1px solid #1c2538; border-radius: 12px; padding: 10px 14px; margin-bottom: 24px; }
  .cp-search input { background: none; border: none; color: #e4e4e9; font-size: 14px; flex: 1; font-family: inherit; outline: none; }
  .cp-search input::placeholder { color: #374151; }

  /* Grid */
  .cp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cp-empty { text-align: center; color: #374151; padding: 60px 20px; font-size: 15px; }

  /* Card */
  .cp-card { background: #111827; border: 1px solid #1c2538; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; text-decoration: none; color: inherit; transition: border-color 0.15s; }
  .cp-card:hover { border-color: #2a3548; }
  .cp-card-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
  .cp-card-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cp-card-info { flex: 1; min-width: 0; }
  .cp-card-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
  .cp-card-cat { font-size: 12px; color: #4b5563; }
  .cp-role { color: #f59e0b; font-weight: 500; }
  .cp-card-desc { font-size: 14px; color: #7c8296; line-height: 1.55; margin: 0 0 18px; flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .cp-card-bottom { display: flex; align-items: center; justify-content: space-between; }
  .cp-card-stats { display: flex; align-items: center; gap: 14px; }
  .cp-card-stats span { font-size: 13px; color: #4b5563; display: flex; align-items: center; gap: 5px; }

  /* Join */
  .cp-join-btn { background: none; border: 1.5px solid #f59e0b; color: #f59e0b; padding: 7px 20px; border-radius: 24px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .cp-join-btn:hover { background: #f59e0b; color: #0c1220; }
  .cp-joined-badge { font-size: 12px; color: #10b981; font-weight: 600; padding: 6px 14px; border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; }

  /* Create card */
  .cp-card-create { border-style: dashed; align-items: center; justify-content: center; min-height: 200px; cursor: pointer; }
  .cp-card-create:hover { border-color: #f59e0b; }
  .cp-create-icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(245,158,11,0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .cp-create-label { font-weight: 500; font-size: 14px; color: #7c8296; }
  .cp-create-sub { font-size: 12px; color: #374151; margin-top: 4px; }

  /* Modal */
  .cp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
  .cp-modal { background: #111827; border: 1px solid #1c2538; border-radius: 20px; width: 90%; max-width: 520px; overflow: hidden; }
  .cp-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 0; }
  .cp-modal-header h2 { font-size: 18px; font-weight: 600; margin: 0; }
  .cp-modal-close { background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px; }
  .cp-modal-close:hover { color: #e4e4e9; }
  .cp-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .cp-field { display: flex; flex-direction: column; gap: 6px; }
  .cp-field label { font-size: 13px; font-weight: 500; color: #9ca3af; }
  .cp-field input, .cp-field textarea, .cp-field select { background: #0c1220; border: 1px solid #1c2538; border-radius: 10px; padding: 11px 14px; color: #e4e4e9; font-size: 14px; font-family: inherit; resize: vertical; }
  .cp-field input:focus, .cp-field textarea:focus, .cp-field select:focus { outline: none; border-color: #f59e0b; }
  .cp-modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 0 24px 20px; }
  .cp-cancel { background: none; border: 1px solid #1c2538; color: #9ca3af; padding: 9px 22px; border-radius: 24px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; }
  .cp-cancel:hover { border-color: #2a3548; color: #e4e4e9; }
  .cp-submit { background: #f59e0b; color: #0c1220; border: none; padding: 9px 24px; border-radius: 24px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 13px; }
  .cp-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .cp-submit:hover:not(:disabled) { background: #d97706; }

  /* Mobile */
  @media (max-width: 640px) {
    .cp { padding: 20px 16px; }
    .cp-grid { grid-template-columns: 1fr; }
    .cp-title { font-size: 24px; }
  }
</style>
