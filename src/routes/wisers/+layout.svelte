<script lang="ts">
  import { onMount } from 'svelte';
  import WisersMobileNav from '$lib/components/WisersMobileNav.svelte';
  import { auth } from '$lib/stores/auth';
  import { page } from '$app/stores';
  import { fetchUnreadCounts, connectWS } from '$lib/stores/wisers-ws';
  let { children } = $props();

  // Feed page (/wisers exactly) has its own mobile nav with create sheet
  const isFeed = $derived($page.url.pathname === '/wisers' || $page.url.pathname === '/wisers/');

  onMount(() => {
    if ($auth.token) {
      fetchUnreadCounts($auth.token);
      connectWS($auth.token);
    }
  });
</script>

{@render children()}

{#if $auth.token && !isFeed}
  <WisersMobileNav />
{/if}

<style>
  @media (max-width: 768px) {
    :global(body) {
      padding-bottom: calc(64px + env(safe-area-inset-bottom, 0)) !important;
    }
  }
</style>
