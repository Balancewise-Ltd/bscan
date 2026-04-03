<script lang="ts">
  import { onMount } from 'svelte';
  import * as api from '$lib/api/client';

  let categories = $state<Record<string, any[]>>({});
  let loading = $state(true);
  let search = $state('');
  let searchResults = $state<any[]>([]);
  let searching = $state(false);
  let activeArticle = $state<any>(null);
  let articleLoading = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const catIcons: Record<string, string> = {
    getting_started: '🚀', account: '👤', privacy: '🔒', safety: '🛡️',
    communities: '👥', posting: '✏️', messaging: '💬', troubleshooting: '🔧',
    billing: '💳', general: '📋',
  };

  onMount(async () => {
    try {
      const d = await api.getHelpArticles();
      categories = d.categories || {};
    } catch {}
    loading = false;
  });

  function doSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    if (!search.trim() || search.length < 2) { searchResults = []; return; }
    searching = true;
    searchTimer = setTimeout(async () => {
      try {
        const d = await api.searchHelpArticles(search);
        searchResults = d.articles || [];
      } catch { searchResults = []; }
      searching = false;
    }, 300);
  }

  async function openArticle(slug: string) {
    articleLoading = true;
    try {
      const d = await api.getHelpArticle(slug);
      activeArticle = d.article;
    } catch { activeArticle = null; }
    articleLoading = false;
  }

  function closeArticle() { activeArticle = null; }

  function catLabel(c: string) {
    return c.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }
</script>

<svelte:head><title>Help Centre — BSCAN</title></svelte:head>

<div class="help">
  {#if activeArticle}
    <!-- Article view -->
    <div class="help-article">
      <button class="help-back" onclick={closeArticle}>&larr; Back to Help Centre</button>
      <h1 class="help-article-title">{activeArticle.title}</h1>
      <div class="help-article-meta">
        <span class="help-cat">{catLabel(activeArticle.category)}</span>
        {#if activeArticle.updated_at}
          <span class="help-updated">Updated {new Date(activeArticle.updated_at).toLocaleDateString()}</span>
        {/if}
      </div>
      <div class="help-article-body">{activeArticle.content}</div>
      <div class="help-article-footer">
        <p>Still need help? <a href="/support">Contact Support</a></p>
      </div>
    </div>
  {:else}
    <!-- Help Centre main -->
    <div class="help-header">
      <h1 class="help-title">Help Centre</h1>
      <p class="help-sub">Find answers to common questions about BSCAN</p>
      <div class="help-search">
        <input
          bind:value={search}
          oninput={doSearch}
          placeholder="Search for help..."
          class="help-search-input"
        />
        {#if searching}
          <span class="help-search-spin"></span>
        {/if}
      </div>
    </div>

    {#if search.length >= 2}
      <!-- Search results -->
      <div class="help-results">
        {#if !searchResults.length && !searching}
          <p class="help-empty">No articles found for "{search}"</p>
        {:else}
          {#each searchResults as r}
            <button class="help-result" onclick={() => openArticle(r.slug)}>
              <div class="help-result-title">{r.title}</div>
              <div class="help-result-cat">{catLabel(r.category)}</div>
              <div class="help-result-preview">{r.preview}</div>
            </button>
          {/each}
        {/if}
      </div>
    {:else if loading}
      <div class="help-loading">Loading...</div>
    {:else}
      <!-- Categories grid -->
      <div class="help-grid">
        {#each Object.entries(categories) as [cat, articles]}
          <div class="help-cat-card">
            <div class="help-cat-header">
              <span class="help-cat-icon">{catIcons[cat] || '📋'}</span>
              <span class="help-cat-name">{catLabel(cat)}</span>
              <span class="help-cat-count">{articles.length}</span>
            </div>
            <div class="help-cat-articles">
              {#each articles as a}
                <button class="help-cat-link" onclick={() => openArticle(a.slug)}>{a.title}</button>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      {#if !Object.keys(categories).length}
        <div class="help-empty-state">
          <p>No help articles yet.</p>
          <a href="/support" class="help-contact">Contact Support</a>
        </div>
      {/if}

      <div class="help-footer">
        <p>Can't find what you're looking for?</p>
        <a href="https://help.wisrs.com" target="_blank" rel="noopener" class="help-contact" style="margin-right:8px">Visit Full Help Centre</a>
        <a href="/support" class="help-contact">Talk to Support</a>
      </div>
    {/if}
  {/if}
</div>

<style>
  .help { max-width: 800px; margin: 0 auto; padding: 32px 16px; min-height: calc(100vh - 80px); }

  .help-header { text-align: center; margin-bottom: 32px; }
  .help-title { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
  .help-sub { font-size: 14px; color: var(--clr-text-muted, #888); margin-bottom: 20px; }
  .help-search { position: relative; max-width: 480px; margin: 0 auto; }
  .help-search-input {
    width: 100%; padding: 12px 20px; border-radius: 24px;
    border: 1px solid var(--clr-border); background: var(--clr-bg-card, #1a1a2e);
    color: var(--clr-text-primary); font-size: 14px; outline: none; font-family: inherit;
  }
  .help-search-input:focus { border-color: var(--clr-gold); }
  .help-search-spin { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; border: 2px solid var(--clr-border); border-top-color: var(--clr-gold); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }

  .help-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .help-cat-card {
    border: 1px solid var(--clr-border); border-radius: 12px;
    background: var(--clr-bg-card, #1a1a2e); overflow: hidden;
  }
  .help-cat-header {
    display: flex; align-items: center; gap: 8px; padding: 14px 16px;
    border-bottom: 1px solid var(--clr-border);
  }
  .help-cat-icon { font-size: 18px; }
  .help-cat-name { font-size: 14px; font-weight: 700; flex: 1; }
  .help-cat-count { font-size: 11px; color: var(--clr-text-muted); background: var(--clr-bg-deep); padding: 2px 8px; border-radius: 10px; }
  .help-cat-articles { padding: 8px; }
  .help-cat-link {
    display: block; width: 100%; text-align: left; padding: 8px 10px; border-radius: 6px;
    background: none; border: none; color: var(--clr-text-secondary, #aaa); font-size: 13px;
    cursor: pointer; font-family: inherit; transition: all 0.12s;
  }
  .help-cat-link:hover { color: var(--clr-gold); background: rgba(245,166,35,0.06); }

  .help-results { display: flex; flex-direction: column; gap: 8px; }
  .help-result {
    text-align: left; padding: 14px 16px; border-radius: 10px;
    border: 1px solid var(--clr-border); background: var(--clr-bg-card);
    cursor: pointer; transition: all 0.12s; width: 100%; font-family: inherit;
  }
  .help-result:hover { border-color: var(--clr-gold); }
  .help-result-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; color: var(--clr-text-primary); }
  .help-result-cat { font-size: 10px; color: var(--clr-gold); font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
  .help-result-preview { font-size: 12px; color: var(--clr-text-muted); line-height: 1.4; }

  .help-empty { text-align: center; color: var(--clr-text-muted); font-size: 14px; padding: 24px; }
  .help-loading { text-align: center; color: var(--clr-text-muted); font-size: 14px; padding: 40px; }

  .help-article { max-width: 640px; margin: 0 auto; }
  .help-back { background: none; border: none; color: var(--clr-gold); font-size: 13px; cursor: pointer; font-family: inherit; margin-bottom: 16px; padding: 0; }
  .help-back:hover { text-decoration: underline; }
  .help-article-title { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
  .help-article-meta { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
  .help-cat { font-size: 11px; font-weight: 700; color: var(--clr-gold); text-transform: uppercase; }
  .help-updated { font-size: 11px; color: var(--clr-text-muted); }
  .help-article-body { font-size: 14px; line-height: 1.8; color: var(--clr-text-secondary); white-space: pre-wrap; }
  .help-article-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--clr-border); text-align: center; font-size: 13px; color: var(--clr-text-muted); }
  .help-article-footer a { color: var(--clr-gold); font-weight: 600; }

  .help-footer { text-align: center; margin-top: 40px; padding: 24px; color: var(--clr-text-muted); font-size: 13px; }
  .help-contact { display: inline-block; margin-top: 8px; padding: 8px 24px; border-radius: 20px; background: var(--clr-gold, #f5a623); color: #000; font-weight: 700; font-size: 13px; text-decoration: none; }
  .help-empty-state { text-align: center; padding: 48px; color: var(--clr-text-muted); }

  @media (max-width: 480px) {
    .help { padding: 16px 12px; }
    .help-title { font-size: 22px; }
    .help-grid { grid-template-columns: 1fr; }
  }
</style>
