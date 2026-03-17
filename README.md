# BSCAN — SvelteKit + TypeScript Rebuild

### By [Balancewise Technologies](https://balancewises.io)

The "big tech" version of BSCAN — rebuilt from the ground up with SvelteKit 5, TypeScript, reactive stores, proper component architecture, and real-time scan progress.

## Live

- **Scanner:** [bscan.balancewises.io](https://bscan.balancewises.io)
- **Dashboard:** [bscan.balancewises.io/account](https://bscan.balancewises.io/account)
- **API Docs:** [bscan.balancewises.io/api-docs](https://bscan.balancewises.io/api-docs)

## Architecture

```
src/
├── app.css                         # Design system — tokens, animations, base styles
├── app.html                        # HTML shell
├── lib/
│   ├── api/
│   │   └── client.ts               # Typed API client (auth, scan, billing, team, SEO)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.svelte       # Fixed nav with mobile menu
│   │   │   ├── Footer.svelte       # Site footer
│   │   │   └── ChatWidget.svelte   # AI chat assistant (floating)
│   │   ├── scanner/
│   │   │   ├── Pricing.svelte      # Pricing cards with billing toggle
│   │   │   ├── ScoreCard.svelte    # Category score card with mini-stats
│   │   │   ├── ScoreRing.svelte    # Animated SVG ring with score
│   │   │   └── Terminal.svelte     # Real-time scan progress terminal
│   │   └── ui/
│   │       └── CheckoutModal.svelte # Stripe checkout overlay
│   ├── stores/
│   │   ├── auth.ts                 # Auth state — login, register, logout, token persistence
│   │   ├── chat.ts                 # Chat messages, typing state, quick prompts
│   │   ├── scan.ts                 # Scan lifecycle — progress simulation, API call, results
│   │   └── ui.ts                   # Mobile menu, billing interval, modals, paywall
│   ├── types/
│   │   └── index.ts                # Full type definitions — plans, scans, issues, enrichment
│   └── utils/
│       └── score.ts                # Score helpers — colors, levels, animation, formatting
├── routes/
│   ├── +layout.svelte              # Root layout — backgrounds, nav, footer, chat, checkout
│   ├── +layout.ts                  # SPA config — SSR off, prerender on
│   ├── +page.svelte                # Scanner — hero, email gate, terminal, results, pricing
│   ├── account/+page.svelte        # Auth + dashboard — login/register, scan history, stats
│   ├── api-docs/+page.svelte       # API documentation with endpoints and examples
│   ├── compare/+page.svelte        # Side-by-side website comparison (Pro+)
│   ├── leaderboard/+page.svelte    # Public leaderboard with period tabs
│   ├── seo/+page.svelte            # SEO tools — keywords, backlinks, AI strategy
│   └── team/+page.svelte           # Team management (Agency)
```

## Tech Stack

| Layer        | Technology                           |
|-------------|---------------------------------------|
| Framework   | SvelteKit 5 (Svelte 5 runes)         |
| Language    | TypeScript (strict)                   |
| Styling     | Scoped CSS + global design system     |
| State       | Svelte stores (reactive)              |
| API Client  | Typed fetch wrapper                   |
| Build       | Vite 7                                |
| Deployment  | Static adapter (GitHub Pages ready)   |
| Fonts       | Instrument Sans + JetBrains Mono      |


## What Changed vs. Old Codebase

| Before (HTML/CSS/JS)                | After (SvelteKit + TS)                     |
|-------------------------------------|--------------------------------------------|
| 6 separate HTML files               | 8 SvelteKit routes with shared layout      |
| ~3500 lines of vanilla JS/CSS       | 28 typed source files with components       |
| Copy-pasted nav/footer on each page | Single layout with reusable components      |
| Inline styles everywhere            | Design system with CSS custom properties    |
| localStorage scattered              | Centralized stores with reactive state      |
| No type safety                      | Full TypeScript with domain types           |
| Manual DOM manipulation             | Declarative Svelte templates                |
| No component reuse                  | ScoreCard, ScoreRing, Terminal, etc.        |
| var API = '...' on every page       | Single typed API client                     |
| setInterval scan animation          | Store-driven reactive progress              |
| No build step                       | Vite build with code splitting + treeshaking|

## Environment

The app connects to an existing API at `https://api-bscan.balancewises.io`. No backend changes needed — it's a drop-in frontend replacement.

## Plans

| Feature             | Free | Pro (£9/mo) | Agency (£29/mo) |
|--------------------|------|-------------|-----------------|
| Website scans      | 3/mo | 30/mo       | Unlimited       |
| Core Web Vitals    | —    | ✓           | ✓               |
| PDF export         | —    | ✓           | ✓ (White-label) |
| Scan history       | —    | ✓           | ✓               |
| Compare tool       | —    | ✓           | ✓               |
| Team members       | —    | —           | Up to 5         |
| API access         | —    | ✓           | ✓               |

---

© 2026 Balancewise Ltd (Company No. 16164776)
