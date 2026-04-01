<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';

  let communities = $state<any[]>([]);
  let myCommunities = $state<any[]>([]);
  let loading = $state(true);
  let search = $state('');
  let activeTab = $state<'discover'|'mine'>('discover');
  let showCreate = $state(false);
  let newName = $state('');
  let newDesc = $state('');
  let newCategory = $state('general');
  let creating = $state(false);

  const categories = ['general','side-hustle','ecommerce','saas','freelance','investing','crypto','property','content-creation','tech','careers','fire'];

  onMount(async () => {
    await Promise.all([loadCommunities(), loadMine()]);
    loading = false;
  });

  async function loadCommunities() {
    try { communities = (await api.getCommunities(1, '', search)).communities || []; } catch {}
  }
  async function loadMine() {
    if (!$auth.token) return;
    try { myCommunities = (await api.getMyCommunities()).communities || []; } catch {}
  }
  async function handleSearch() { await loadCommunities(); }
  async function handleCreate() {
    if (!newName.trim() || creating) return;
    creating = true;
    try {
      const res = await api.createCommunity({ name: newName, description: newDesc, category: newCategory });
      showCreate = false; newName = ''; newDesc = ''; newCategory = 'general';
      await Promise.all([loadCommunities(), loadMine()]);
    } catch (e: any) { alert(e.message || 'Failed'); }
    creating = false;
  }
  async function handleJoin(slug: string) {
    try { await api.joinCommunity(slug); await Promise.all([loadCommunities(), loadMine()]); } catch {}
  }
  function formatCategory(c: string) { return c.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
  function initial(n: string) { return (n || '?')[0].toUpperCase(); }
</script>

<svelte:head><title>Communities — Wisers</title></svelte:head>

<div class="wc-page">
  <div class="wc-header">
    <a href="/wisers" class="wc-back">← Feed</a>
    <h1>Communities</h1>
    <p class="wc-sub">Find your people. Join the conversation.</p>
  </div>

  <div class="wc-tabs">
    <button class:active={activeTab === 'discover'} onclick={() => activeTab = 'discover'}>Discover</button>
    <button class:active={activeTab === 'mine'} onclick={() => activeTab = 'mine'}>My Communities</button>
    {#if $auth.token}
      <button class="wc-create-btn" onclick={() => showCreate = !showCreate}>+ Create</button>
    {/if}
  </div>

  {#if showCreate}
    <div class="wc-create-form">
      <input type="text" bind:value={newName} placeholder="Community name" maxlength="100" class="wc-input" />
      <textarea bind:value={newDesc} placeholder="What's this community about?" maxlength="500" rows="3" class="wc-textarea"></textarea>
      <select bind:value={newCategory} class="wc-select">
        {#each categories as cat}
          <option value={cat}>{formatCategory(cat)}</option>
        {/each}
      </select>
      <div class="wc-create-actions">
        <button class="wc-cancel" onclick={() => showCreate = false}>Cancel</button>
        <button class="wc-submit" onclick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? 'Creating...' : 'Create Community'}
        </button>
      </div>
    </div>
  {/if}

  {#if activeTab === 'discover'}
    <div class="wc-search">
      <input type="text" bind:value={search} placeholder="Search communities..." class="wc-input" oninput={handleSearch} />
    </div>
    {#if loading}
      <div class="wc-empty">Loading...</div>
    {:else if communities.length === 0}
      <div class="wc-empty">No communities yet. Be the first to create one.</div>
    {:else}
      <div class="wc-grid">
        {#each communities as c}
          <a href="/wisers/communities/{c.slug}" class="wc-card">
            <div class="wc-card-icon">{initial(c.name)}</div>
            <div class="wc-card-info">
              <div class="wc-card-name">{c.name}</div>
              <div class="wc-card-cat">{formatCategory(c.category)}</div>
              <div class="wc-card-desc">{c.description || 'No description yet.'}</div>
              <div class="wc-card-stats">
                <span>{c.member_count} member{c.member_count !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{c.post_count} post{c.post_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {#if $auth.token && !myCommunities.some(m => m.id === c.id)}
              <button class="wc-join" onclick|stopPropagation={() => handleJoin(c.slug)}>Join</button>
            {:else if myCommunities.some(m => m.id === c.id)}
              <span class="wc-joined">Joined</span>
            {/if}
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    {#if myCommunities.length === 0}
      <div class="wc-empty">You haven't joined any communities yet.</div>
    {:else}
      <div class="wc-grid">
        {#each myCommunities as c}
          <a href="/wisers/communities/{c.slug}" class="wc-card">
            <div class="wc-card-icon">{initial(c.name)}</div>
            <div class="wc-card-info">
              <div class="wc-card-name">{c.name}</div>
              <div class="wc-card-cat">{formatCategory(c.category)} · {c.role}</div>
              <div class="wc-card-stats">
                <span>{c.member_count} member{c.member_count !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{c.post_count} post{c.post_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .wc-page { max-width: 720px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e2e8f0; min-height: 100vh; }
  .wc-header { margin-bottom: 20px; }
  .wc-back { color: #f5a623; text-decoration: none; font-size: 14px; font-weight: 500; }
  .wc-back:hover { text-decoration: underline; }
  .wc-header h1 { font-size: 28px; font-weight: 800; margin: 8px 0 4px; letter-spacing: -0.5px; }
  .wc-sub { color: #64748b; font-size: 14px; margin: 0; }
  .wc-tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; }
  .wc-tabs button { background: none; border: none; color: #64748b; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; }
  .wc-tabs button.active { color: #f5a623; background: rgba(245,166,35,0.1); }
  .wc-tabs button:hover { color: #e2e8f0; }
  .wc-create-btn { margin-left: auto; color: #000 !important; background: #f5a623 !important; border-radius: 20px !important; font-weight: 700 !important; }
  .wc-create-btn:hover { background: #e09100 !important; }
  .wc-create-form { background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
  .wc-input { background: #0d0d14; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; color: #e2e8f0; font-size: 14px; font-family: inherit; width: 100%; box-sizing: border-box; }
  .wc-input:focus { outline: none; border-color: #f5a623; }
  .wc-textarea { background: #0d0d14; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; color: #e2e8f0; font-size: 14px; font-family: inherit; width: 100%; box-sizing: border-box; resize: vertical; }
  .wc-textarea:focus { outline: none; border-color: #f5a623; }
  .wc-select { background: #0d0d14; border: 1px solid #1e293b; border-radius: 10px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; font-family: inherit; }
  .wc-create-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .wc-cancel { background: none; border: 1px solid #1e293b; color: #94a3b8; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-family: inherit; font-size: 13px; }
  .wc-submit { background: #f5a623; color: #000; border: none; padding: 8px 24px; border-radius: 20px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 13px; }
  .wc-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .wc-search { margin-bottom: 16px; }
  .wc-empty { text-align: center; color: #475569; padding: 60px 20px; font-size: 15px; }
  .wc-grid { display: flex; flex-direction: column; gap: 10px; }
  .wc-card { display: flex; align-items: center; gap: 14px; background: #141420; border: 1px solid #1e293b; border-radius: 14px; padding: 16px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
  .wc-card:hover { border-color: #f5a623; }
  .wc-card-icon { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #f5a623, #e09100); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 22px; flex-shrink: 0; }
  .wc-card-info { flex: 1; min-width: 0; }
  .wc-card-name { font-weight: 700; font-size: 15px; color: #e2e8f0; }
  .wc-card-cat { font-size: 12px; color: #64748b; margin-top: 2px; }
  .wc-card-desc { font-size: 13px; color: #94a3b8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wc-card-stats { font-size: 12px; color: #475569; margin-top: 6px; display: flex; gap: 6px; }
  .wc-join { background: #f5a623; color: #000; border: none; padding: 8px 20px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
  .wc-join:hover { background: #e09100; }
  .wc-joined { color: #10b981; font-size: 13px; font-weight: 600; flex-shrink: 0; }
</style>
