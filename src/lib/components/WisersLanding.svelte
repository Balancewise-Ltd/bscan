<script lang="ts">
  import { onMount } from 'svelte';

  let visible = $state<Set<string>>(new Set());
  let heroMounted = $state(false);

  onMount(() => {
    heroMounted = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-anim');
            if (id) {
              visible = new Set([...visible, id]);
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    const targets = document.querySelectorAll('[data-anim]');
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  });

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  const features = [
    {
      id: 'journey',
      title: 'Share Your Journey',
      desc: 'Post milestones, wins, and lessons. Get real support from people who get it.',
      icon: 'journey'
    },
    {
      id: 'ai',
      title: 'AI Wealth Coach',
      desc: 'Free AI-powered coaching that knows your goals and gives personalised advice.',
      icon: 'ai'
    },
    {
      id: 'mentor',
      title: 'Find a Mentor',
      desc: "Smart matching with people who've already done what you're trying to do.",
      icon: 'mentor'
    },
    {
      id: 'discover',
      title: 'Discover Feed',
      desc: 'Algorithm-powered feed that surfaces the best content and people for you.',
      icon: 'discover'
    },
    {
      id: 'groups',
      title: 'Group Chats',
      desc: 'Private groups for masterminds, accountability partners, and niche communities.',
      icon: 'groups'
    },
    {
      id: 'leaderboard',
      title: 'Leaderboard',
      desc: "See who's crushing it. Get inspired. Compete with yourself.",
      icon: 'leaderboard'
    }
  ];

  const steps = [
    {
      num: '01',
      title: 'Sign up in 30 seconds',
      desc: 'Free, no credit card. Just your email.'
    },
    {
      num: '02',
      title: 'Set your goals',
      desc: 'Tell us where you are and where you want to be.'
    },
    {
      num: '03',
      title: 'Start building',
      desc: 'Post, connect, learn, and grow with the community.'
    }
  ];

  const testimonials = [
    {
      quote: "Wisers gave me the accountability I needed. Went from zero side income to consistent revenue in 4 months.",
      name: 'Jordan K.',
      role: 'E-commerce builder'
    },
    {
      quote: "The AI coach alone is worth it. It's like having a business advisor in your pocket, completely free.",
      name: 'Priya M.',
      role: 'Freelance developer'
    },
    {
      quote: "Finally a community that actually understands the grind. No fluff, just real people building real things.",
      name: 'Marcus T.',
      role: 'SaaS founder'
    }
  ];
</script>

<div class="wl">
  <!-- HERO -->
  <section class="wl-hero" class:mounted={heroMounted}>
    <div class="wl-hero-bg">
      <div class="wl-hero-grad"></div>
      <div class="wl-hero-shimmer"></div>
    </div>
    <div class="wl-hero-inner">
      <div class="wl-hero-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>Free to join. Built for builders.</span>
      </div>
      <h1 class="wl-hero-h1">Your wealth journey<br/>starts here</h1>
      <p class="wl-hero-sub">
        Join a community of builders, hustlers, and future millionaires.
        Track milestones, find mentors, and grow together.
      </p>
      <div class="wl-hero-ctas">
        <a href="/account" class="wl-btn wl-btn-gold">
          Join Wisers — it's free
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
        <button class="wl-btn wl-btn-outline" onclick={() => scrollToSection('wl-features')}>
          See how it works
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      <div class="wl-hero-stats-row">
        <div class="wl-hero-stat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wgold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Real Community</span>
        </div>
        <div class="wl-hero-stat-sep"></div>
        <div class="wl-hero-stat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wgold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          <span>20+ Features</span>
        </div>
        <div class="wl-hero-stat-sep"></div>
        <div class="wl-hero-stat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--wgold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>Free AI Coach</span>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="wl-section" id="wl-features">
    <div class="wl-container">
      <div class="wl-section-header" data-anim="feat-header">
        <span class="wl-label">What you get</span>
        <h2 class="wl-h2" class:anim-in={visible.has('feat-header')}>Everything you need to build wealth</h2>
        <p class="wl-section-sub" class:anim-in={visible.has('feat-header')}>
          Tools, community, and coaching to help you go from zero to your first
          (or next) milestone.
        </p>
      </div>
      <div class="wl-features-grid">
        {#each features as feat, i}
          <div
            class="wl-feature-card"
            class:anim-in={visible.has('feat-' + i)}
            data-anim={'feat-' + i}
            style="transition-delay: {i * 80}ms"
          >
            <div class="wl-feature-icon">
              {#if feat.icon === 'journey'}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              {:else if feat.icon === 'ai'}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 8h2m6 0h2M9 11h6"/>
                </svg>
              {:else if feat.icon === 'mentor'}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              {:else if feat.icon === 'discover'}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                </svg>
              {:else if feat.icon === 'groups'}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              {:else if feat.icon === 'leaderboard'}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              {/if}
            </div>
            <h3 class="wl-feature-title">{feat.title}</h3>
            <p class="wl-feature-desc">{feat.desc}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section class="wl-section wl-section-alt">
    <div class="wl-container">
      <div class="wl-section-header" data-anim="how-header">
        <span class="wl-label">How it works</span>
        <h2 class="wl-h2" class:anim-in={visible.has('how-header')}>Start in under a minute</h2>
        <p class="wl-section-sub" class:anim-in={visible.has('how-header')}>
          Three simple steps to join the movement.
        </p>
      </div>
      <div class="wl-steps">
        {#each steps as step, i}
          <div
            class="wl-step"
            class:anim-in={visible.has('step-' + i)}
            data-anim={'step-' + i}
            style="transition-delay: {i * 120}ms"
          >
            <div class="wl-step-num">{step.num}</div>
            <div class="wl-step-content">
              <h3 class="wl-step-title">{step.title}</h3>
              <p class="wl-step-desc">{step.desc}</p>
            </div>
            {#if i < steps.length - 1}
              <div class="wl-step-connector"></div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- SOCIAL PROOF -->
  <section class="wl-section">
    <div class="wl-container">
      <div class="wl-section-header" data-anim="proof-header">
        <span class="wl-label">Social proof</span>
        <h2 class="wl-h2" class:anim-in={visible.has('proof-header')}>Built for wealth builders</h2>
        <p class="wl-section-sub" class:anim-in={visible.has('proof-header')}>
          Real people, real goals, real progress.
        </p>
      </div>

      <div class="wl-stats-bar" data-anim="stats-bar">
        <div class="wl-stat-item" class:anim-in={visible.has('stats-bar')}>
          <div class="wl-stat-num">20+</div>
          <div class="wl-stat-label">Features</div>
        </div>
        <div class="wl-stat-divider"></div>
        <div class="wl-stat-item" class:anim-in={visible.has('stats-bar')} style="transition-delay: 100ms">
          <div class="wl-stat-num">Free</div>
          <div class="wl-stat-label">AI Coach</div>
        </div>
        <div class="wl-stat-divider"></div>
        <div class="wl-stat-item" class:anim-in={visible.has('stats-bar')} style="transition-delay: 200ms">
          <div class="wl-stat-num">Real</div>
          <div class="wl-stat-label">Community</div>
        </div>
      </div>

      <div class="wl-testimonials">
        {#each testimonials as t, i}
          <div
            class="wl-testimonial"
            class:anim-in={visible.has('test-' + i)}
            data-anim={'test-' + i}
            style="transition-delay: {i * 100}ms"
          >
            <div class="wl-testimonial-quote">
              <svg class="wl-quote-icon" width="20" height="20" viewBox="0 0 24 24" fill="var(--wgold)" opacity="0.3">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
              </svg>
              <p>{t.quote}</p>
            </div>
            <div class="wl-testimonial-author">
              <div class="wl-testimonial-avatar">{t.name[0]}</div>
              <div>
                <div class="wl-testimonial-name">{t.name}</div>
                <div class="wl-testimonial-role">{t.role}</div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="wl-section wl-cta-section">
    <div class="wl-cta-bg">
      <div class="wl-cta-glow"></div>
    </div>
    <div class="wl-container wl-cta-inner" data-anim="final-cta">
      <h2 class="wl-cta-h2" class:anim-in={visible.has('final-cta')}>Ready to build your wealth?</h2>
      <p class="wl-cta-sub" class:anim-in={visible.has('final-cta')}>
        Join thousands of wealth builders on Wisers.
        Your next milestone is closer than you think.
      </p>
      <a href="/account" class="wl-btn wl-btn-gold wl-btn-lg" class:anim-in={visible.has('final-cta')}>
        Get Started Free
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </a>
      <p class="wl-cta-fine">No credit card required. Free forever.</p>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="wl-footer">
    <div class="wl-container wl-footer-inner">
      <div class="wl-footer-brand">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="var(--wgold)"/>
          <text x="16" y="22" text-anchor="middle" font-size="16" font-weight="700" fill="#0a0a0f" font-family="inherit">W</text>
        </svg>
        <span class="wl-footer-name">Wisers</span>
      </div>
      <p class="wl-footer-copy">wisrs.com</p>
    </div>
  </footer>
</div>

<style>
  /* ── Variables & Theme ─────────────────────────── */
  .wl {
    --wbg: #0a0a0f;
    --wcard: #111117;
    --wt: #e4e6ea;
    --wgold: #f5a623;
    --wbd: #1e1e2a;
    --wt-muted: #8a8d93;
    --wt-dim: #6b6e75;
    --wcard-hover: #16161e;
    --wradius: 16px;

    background: var(--wbg);
    color: var(--wt);
    font-family: inherit;
    line-height: 1.6;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  :global([data-wisers-theme="light"]) .wl {
    --wbg: #ffffff;
    --wcard: #f8f9fa;
    --wt: #1c1e21;
    --wgold: #d4a017;
    --wbd: #dddfe2;
    --wt-muted: #606770;
    --wt-dim: #90949c;
    --wcard-hover: #f0f1f3;
  }

  /* ── Animation Base ───────────────────────────── */
  .wl-h2,
  .wl-section-sub,
  .wl-feature-card,
  .wl-step,
  .wl-stat-item,
  .wl-testimonial,
  .wl-cta-h2,
  .wl-cta-sub,
  .wl-btn-lg {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .anim-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }

  /* ── Container ────────────────────────────────── */
  .wl-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* ── Section Label ────────────────────────────── */
  .wl-label {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--wgold);
    margin-bottom: 12px;
  }

  /* ── Sections ─────────────────────────────────── */
  .wl-section {
    padding: 100px 0;
    position: relative;
  }

  .wl-section-alt {
    background: var(--wcard);
  }

  .wl-section-header {
    text-align: center;
    margin-bottom: 64px;
  }

  .wl-h2 {
    font-size: clamp(28px, 5vw, 42px);
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 16px;
    letter-spacing: -0.5px;
    color: var(--wt);
  }

  .wl-section-sub {
    font-size: 17px;
    color: var(--wt-muted);
    max-width: 520px;
    margin: 0 auto;
    line-height: 1.7;
  }

  /* ── HERO ─────────────────────────────────────── */
  .wl-hero {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 80px 20px 60px;
  }

  .wl-hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .wl-hero-grad {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 40%, rgba(245, 166, 35, 0.08) 0%, transparent 70%),
      radial-gradient(ellipse 60% 50% at 20% 80%, rgba(245, 166, 35, 0.04) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 80% 20%, rgba(245, 166, 35, 0.03) 0%, transparent 50%),
      var(--wbg);
  }

  .wl-hero-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      120deg,
      transparent 30%,
      rgba(245, 166, 35, 0.03) 45%,
      rgba(245, 166, 35, 0.06) 50%,
      rgba(245, 166, 35, 0.03) 55%,
      transparent 70%
    );
    background-size: 200% 100%;
    animation: wl-shimmer 6s ease-in-out infinite;
  }

  @keyframes wl-shimmer {
    0%, 100% { background-position: 200% 0; }
    50% { background-position: -200% 0; }
  }

  .wl-hero-inner {
    position: relative;
    z-index: 1;
    text-align: center;
    max-width: 720px;
  }

  .wl-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: rgba(245, 166, 35, 0.1);
    border: 1px solid rgba(245, 166, 35, 0.2);
    border-radius: 100px;
    color: var(--wgold);
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 32px;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s;
  }

  .mounted .wl-hero-badge {
    opacity: 1;
    transform: translateY(0);
  }

  .wl-hero-h1 {
    font-size: clamp(36px, 7vw, 64px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -1.5px;
    margin: 0 0 24px;
    color: var(--wt);
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.7s ease 0.35s, transform 0.7s ease 0.35s;
  }

  .mounted .wl-hero-h1 {
    opacity: 1;
    transform: translateY(0);
  }

  .wl-hero-sub {
    font-size: clamp(16px, 2.5vw, 19px);
    color: var(--wt-muted);
    line-height: 1.7;
    margin: 0 auto 40px;
    max-width: 540px;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s;
  }

  .mounted .wl-hero-sub {
    opacity: 1;
    transform: translateY(0);
  }

  .wl-hero-ctas {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.7s ease 0.65s, transform 0.7s ease 0.65s;
  }

  .mounted .wl-hero-ctas {
    opacity: 1;
    transform: translateY(0);
  }

  .wl-hero-stats-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-top: 56px;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.7s ease 0.8s, transform 0.7s ease 0.8s;
  }

  .mounted .wl-hero-stats-row {
    opacity: 1;
    transform: translateY(0);
  }

  .wl-hero-stat {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--wt-muted);
    font-weight: 500;
  }

  .wl-hero-stat-sep {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--wt-dim);
  }

  /* ── Buttons ──────────────────────────────────── */
  .wl-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    border: none;
    text-decoration: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .wl-btn:active {
    transform: scale(0.97);
  }

  .wl-btn-gold {
    background: var(--wgold);
    color: #0a0a0f;
    box-shadow: 0 4px 24px rgba(245, 166, 35, 0.25);
  }

  .wl-btn-gold:hover {
    box-shadow: 0 6px 32px rgba(245, 166, 35, 0.35);
    transform: translateY(-1px);
  }

  .wl-btn-outline {
    background: transparent;
    color: var(--wt);
    border: 1.5px solid var(--wbd);
  }

  .wl-btn-outline:hover {
    border-color: var(--wgold);
    color: var(--wgold);
  }

  .wl-btn-lg {
    padding: 18px 40px;
    font-size: 17px;
    border-radius: 14px;
  }

  /* ── Features Grid ────────────────────────────── */
  .wl-features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .wl-feature-card {
    background: var(--wcard);
    border: 1px solid var(--wbd);
    border-radius: var(--wradius);
    padding: 32px 28px;
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.25s ease,
                box-shadow 0.25s ease;
  }

  .wl-feature-card:hover {
    border-color: rgba(245, 166, 35, 0.3);
    box-shadow: 0 8px 40px rgba(245, 166, 35, 0.06);
  }

  .wl-feature-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(245, 166, 35, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    color: var(--wgold);
  }

  .wl-feature-title {
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 10px;
    color: var(--wt);
  }

  .wl-feature-desc {
    font-size: 14px;
    color: var(--wt-muted);
    line-height: 1.65;
    margin: 0;
  }

  /* ── Steps ────────────────────────────────────── */
  .wl-steps {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 560px;
    margin: 0 auto;
  }

  .wl-step {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    padding: 32px 0;
    position: relative;
  }

  .wl-step-num {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(245, 166, 35, 0.12);
    color: var(--wgold);
    font-size: 16px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wl-step-connector {
    position: absolute;
    left: 24px;
    top: 80px;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, var(--wgold), transparent);
    transform: translateX(-1px);
    opacity: 0.3;
  }

  .wl-step-content {
    flex: 1;
    padding-top: 2px;
  }

  .wl-step-title {
    font-size: 19px;
    font-weight: 700;
    margin: 0 0 6px;
    color: var(--wt);
  }

  .wl-step-desc {
    font-size: 15px;
    color: var(--wt-muted);
    margin: 0;
    line-height: 1.6;
  }

  /* ── Stats Bar ────────────────────────────────── */
  .wl-stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 48px;
    padding: 48px 32px;
    background: var(--wcard);
    border: 1px solid var(--wbd);
    border-radius: 20px;
    margin-bottom: 64px;
  }

  .wl-stat-item {
    text-align: center;
  }

  .wl-stat-num {
    font-size: clamp(28px, 4vw, 36px);
    font-weight: 800;
    color: var(--wgold);
    line-height: 1.2;
  }

  .wl-stat-label {
    font-size: 14px;
    color: var(--wt-muted);
    margin-top: 4px;
    font-weight: 500;
  }

  .wl-stat-divider {
    width: 1px;
    height: 48px;
    background: var(--wbd);
  }

  /* ── Testimonials ─────────────────────────────── */
  .wl-testimonials {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .wl-testimonial {
    background: var(--wcard);
    border: 1px solid var(--wbd);
    border-radius: var(--wradius);
    padding: 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .wl-testimonial-quote {
    position: relative;
    margin-bottom: 24px;
  }

  .wl-quote-icon {
    margin-bottom: 12px;
  }

  .wl-testimonial-quote p {
    font-size: 15px;
    line-height: 1.7;
    color: var(--wt);
    margin: 0;
    font-style: italic;
  }

  .wl-testimonial-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .wl-testimonial-avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(245, 166, 35, 0.15);
    color: var(--wgold);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }

  .wl-testimonial-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--wt);
  }

  .wl-testimonial-role {
    font-size: 12px;
    color: var(--wt-dim);
    margin-top: 1px;
  }

  /* ── Final CTA ────────────────────────────────── */
  .wl-cta-section {
    padding: 120px 0;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .wl-cta-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .wl-cta-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(245, 166, 35, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }

  .wl-cta-inner {
    position: relative;
    z-index: 1;
  }

  .wl-cta-h2 {
    font-size: clamp(30px, 6vw, 48px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -1px;
    margin: 0 0 20px;
    color: var(--wt);
  }

  .wl-cta-sub {
    font-size: 17px;
    color: var(--wt-muted);
    max-width: 440px;
    margin: 0 auto 40px;
    line-height: 1.7;
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s,
                transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
  }

  .wl-cta-fine {
    font-size: 13px;
    color: var(--wt-dim);
    margin-top: 16px;
  }

  /* ── Footer ───────────────────────────────────── */
  .wl-footer {
    padding: 32px 0;
    border-top: 1px solid var(--wbd);
  }

  .wl-footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .wl-footer-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .wl-footer-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--wt);
  }

  .wl-footer-copy {
    font-size: 13px;
    color: var(--wt-dim);
    margin: 0;
  }

  /* ── Responsive: Tablet ───────────────────────── */
  @media (max-width: 900px) {
    .wl-features-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .wl-testimonials {
      grid-template-columns: repeat(2, 1fr);
    }

    .wl-testimonials .wl-testimonial:last-child {
      grid-column: 1 / -1;
      max-width: 480px;
      margin: 0 auto;
    }

    .wl-stats-bar {
      gap: 32px;
      padding: 40px 24px;
    }
  }

  /* ── Responsive: Mobile ───────────────────────── */
  @media (max-width: 640px) {
    .wl-section {
      padding: 72px 0;
    }

    .wl-section-header {
      margin-bottom: 48px;
    }

    .wl-features-grid {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .wl-feature-card {
      padding: 24px 22px;
    }

    .wl-feature-icon {
      width: 42px;
      height: 42px;
      margin-bottom: 16px;
    }

    .wl-hero {
      padding: 60px 20px 48px;
      min-height: auto;
      min-height: calc(100dvh - 40px);
    }

    .wl-hero-badge {
      font-size: 12px;
      padding: 5px 14px;
      margin-bottom: 24px;
    }

    .wl-hero-ctas {
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }

    .wl-hero-ctas .wl-btn {
      width: 100%;
      justify-content: center;
    }

    .wl-hero-stats-row {
      gap: 14px;
      margin-top: 40px;
      flex-wrap: wrap;
    }

    .wl-hero-stat {
      font-size: 12px;
    }

    .wl-steps {
      padding: 0;
    }

    .wl-step {
      gap: 18px;
      padding: 24px 0;
    }

    .wl-step-num {
      width: 42px;
      height: 42px;
      font-size: 14px;
      border-radius: 12px;
    }

    .wl-step-connector {
      left: 21px;
      top: 66px;
    }

    .wl-step-title {
      font-size: 17px;
    }

    .wl-stats-bar {
      flex-direction: column;
      gap: 24px;
      padding: 32px 24px;
      border-radius: 16px;
    }

    .wl-stat-divider {
      width: 48px;
      height: 1px;
    }

    .wl-testimonials {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .wl-testimonials .wl-testimonial:last-child {
      max-width: none;
    }

    .wl-testimonial {
      padding: 22px;
    }

    .wl-cta-section {
      padding: 80px 0;
    }

    .wl-cta-glow {
      width: 360px;
      height: 360px;
    }

    .wl-btn-lg {
      padding: 16px 32px;
      font-size: 16px;
      width: 100%;
      justify-content: center;
    }

    .wl-footer-inner {
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }
  }

  /* ── Small phones ─────────────────────────────── */
  @media (max-width: 380px) {
    .wl-container {
      padding: 0 16px;
    }

    .wl-hero-h1 {
      font-size: 32px;
    }

    .wl-hero-sub {
      font-size: 15px;
    }
  }
</style>
