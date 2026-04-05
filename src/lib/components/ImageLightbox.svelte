<script lang="ts">
  let { src = '', alt = '', onclose }: { src: string; alt?: string; onclose: () => void } = $props();
  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let lastDist = $state(0);
  let dragging = $state(false);
  let dragStart = $state({ x: 0, y: 0 });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale = Math.max(0.5, Math.min(5, scale + delta));
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1 && scale > 1) {
      dragging = true;
      dragStart = { x: e.touches[0].clientX - translateX, y: e.touches[0].clientY - translateY };
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist > 0) {
        scale = Math.max(0.5, Math.min(5, scale * (dist / lastDist)));
      }
      lastDist = dist;
    } else if (e.touches.length === 1 && dragging && scale > 1) {
      translateX = e.touches[0].clientX - dragStart.x;
      translateY = e.touches[0].clientY - dragStart.y;
    }
  }

  function handleTouchEnd() {
    lastDist = 0;
    dragging = false;
    if (scale <= 1) { translateX = 0; translateY = 0; }
  }

  function handleDoubleTap(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (scale > 1) {
      scale = 1; translateX = 0; translateY = 0;
    } else {
      scale = 2.5;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('lb-wrap')) onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="lb-wrap" onclick={handleBackdropClick}
  ontouchstart={handleTouchStart} ontouchmove={handleTouchMove} ontouchend={handleTouchEnd}
  onwheel={handleWheel} role="dialog" aria-modal="true" aria-label="Image viewer" tabindex="-1">
  <button class="lb-close" onclick={onclose} aria-label="Close">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <img
    {src} {alt} class="lb-img"
    style="transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px)"
    ondblclick={handleDoubleTap}
    draggable="false"
  />
  {#if scale > 1}
    <div class="lb-zoom-hint">{Math.round(scale * 100)}%</div>
  {/if}
</div>

<style>
  .lb-wrap {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0,0,0,0.92);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    animation: lbFadeIn 0.2s ease-out;
    touch-action: none;
    cursor: zoom-out;
  }
  @keyframes lbFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .lb-close {
    position: absolute; top: 16px; right: 16px; z-index: 10001;
    background: rgba(255,255,255,0.1); border: none; color: #fff;
    width: 44px; height: 44px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s;
  }
  .lb-close:hover { background: rgba(255,255,255,0.2); }

  .lb-img {
    max-width: 90vw; max-height: 90vh;
    object-fit: contain; border-radius: 4px;
    transition: transform 0.1s ease-out;
    user-select: none; -webkit-user-select: none;
    cursor: zoom-in;
  }

  .lb-zoom-hint {
    position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.6); color: #fff;
    padding: 4px 12px; border-radius: 12px;
    font-size: 12px; font-weight: 600;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .lb-close { top: 12px; right: 12px; width: 40px; height: 40px; }
    .lb-img { max-width: 100vw; max-height: 100vh; border-radius: 0; }
  }
</style>
