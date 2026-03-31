<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import Navbar from '$lib/components/layout/Navbar.svelte';
	import { page } from '$app/stores';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Faq from '$lib/components/scanner/Faq.svelte';
	import ChatWidget from '$lib/components/layout/ChatWidget.svelte';
	import WisersDM from '$lib/components/layout/WisersDM.svelte';
	import { browser } from '$app/environment';
	import CheckoutModal from '$lib/components/ui/CheckoutModal.svelte';
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte';

	let { children } = $props();

	onMount(() => {
		auth.init();

		// Register service worker for offline support
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch(() => {});
		}
	});
</script>

<a href="#main-content" class="skip-link">Skip to content</a>

<div class="bg-mesh" aria-hidden="true"></div>
<div class="bg-grid" aria-hidden="true"></div>

{#if !$page.url.pathname.startsWith('/wisers')}
<Navbar />
{/if}

<ErrorBoundary>
	<main class="page" id="main-content" role="main">
		{@render children()}
	</main>
</ErrorBoundary>

{#if !$page.url.pathname.startsWith('/wisers')}
<Faq />
<Footer />
{/if}
{#if !$page.url.pathname.startsWith('/wisers')}
<ChatWidget />
{/if}
{#if browser}<WisersDM />{/if}
<CheckoutModal />

<style>
	.skip-link {
		position: absolute;
		top: -100px;
		left: 16px;
		z-index: 999;
		padding: 10px 20px;
		background: var(--clr-gold);
		color: var(--clr-bg-deep);
		font-weight: 700;
		font-size: 13px;
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: top 0.2s;
	}
	.skip-link:focus {
		top: 8px;
	}

	/* Hide third-party chat widget on Wisers pages */
	:global(body.wisers-page #crisp-chatbox, body.wisers-page .tawk-min-container, body.wisers-page [class*="chat-widget"], body.wisers-page iframe[title*="chat"], body.wisers-page .chat-widget-container) { display: none !important; }
	:global(body.wisers-page main.page) { padding-top: 0 !important; }
</style>
