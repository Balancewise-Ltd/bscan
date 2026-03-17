<script lang="ts">
	import { page } from '$app/stores';
	import { PUBLIC_SITE_URL } from '$env/static/public';

	interface Props {
		title: string;
		description: string;
		ogImage?: string;
		ogType?: string;
		noindex?: boolean;
		jsonLd?: Record<string, unknown>;
	}

	let {
		title,
		description,
		ogImage = `${PUBLIC_SITE_URL}/Og-image.png`,
		ogType = 'website',
		noindex = false,
		jsonLd
	}: Props = $props();

	const fullTitle = $derived(title.includes('BSCAN') ? title : `${title} — BSCAN`);
	const canonical = $derived(`${PUBLIC_SITE_URL}${$page.url.pathname}`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	<!-- Open Graph -->
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={ogType} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:site_name" content="BSCAN by Balancewise Technologies" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />

	<!-- JSON-LD Structured Data -->
	{#if jsonLd}
		{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
	{/if}
</svelte:head>
