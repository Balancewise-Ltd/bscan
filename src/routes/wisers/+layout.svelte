<script lang="ts">
  import WisersMobileNav from '$lib/components/WisersMobileNav.svelte';
  import { auth } from '$lib/stores/auth';
  let { children } = $props();
</script>

{@render children()}

{#if $auth.token}
  <WisersMobileNav />
{/if}

<style>
  @media (max-width: 768px) {
    :global(body) {
      padding-bottom: calc(64px + env(safe-area-inset-bottom, 0)) !important;
    }
  }
</style>
