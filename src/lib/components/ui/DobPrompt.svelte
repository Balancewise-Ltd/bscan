<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import * as api from '$lib/api/client';

  let { onfinish }: { onfinish: () => void } = $props();

  let dob = $state('');
  let saving = $state(false);
  let error = $state('');

  async function submit() {
    error = '';
    if (!dob) { error = 'Date of birth is required'; return; }
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    if (age < 13) { error = 'You must be at least 13 years old'; return; }
    saving = true;
    try {
      await api.updateProfile($auth.user?.email || '', { date_of_birth: dob });
      auth.refresh();
      onfinish();
    } catch (e: any) { error = e.message || e.detail || 'Failed to save'; }
    saving = false;
  }
</script>

<div class="dob-overlay">
  <div class="dob-card">
    <div class="dob-emoji">&#127874;</div>
    <h2>We need your birthday</h2>
    <p class="dob-desc">This helps us keep our platform safe and comply with age verification requirements.</p>
    <label class="dob-label" for="dob-input">Date of birth</label>
    <input id="dob-input" type="date" class="dob-input" bind:value={dob} max={new Date().toISOString().split('T')[0]} style="color-scheme:dark" />
    {#if error}<p class="dob-error">{error}</p>{/if}
    <button class="dob-btn" onclick={submit} disabled={saving || !dob}>
      {saving ? 'Saving...' : 'Continue'}
    </button>
    <p class="dob-note">Your birthday won't be shown publicly.</p>
  </div>
</div>

<style>
  .dob-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    padding: 16px;
    animation: dobFadeIn 0.3s ease-out;
  }
  @keyframes dobFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

  .dob-card {
    background: var(--clr-bg-card, #0d1117); border: 1px solid var(--clr-border, #1e2a3a); border-radius: 16px;
    width: 100%; max-width: 400px; padding: 36px 28px; text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }

  .dob-emoji { font-size: 48px; margin-bottom: 12px; }

  .dob-card h2 { font-size: 22px; font-weight: 800; color: var(--clr-text, #e4e6ea); margin: 0 0 8px; }
  .dob-desc { font-size: 14px; color: var(--clr-text-muted, #8a8d91); margin: 0 0 24px; line-height: 1.5; }

  .dob-label { display: block; text-align: left; font-size: 12px; font-weight: 600; color: var(--clr-text-muted, #8a8d91); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

  .dob-input {
    width: 100%; padding: 12px; border: 1px solid var(--clr-border, #1e2a3a); border-radius: 10px;
    background: var(--clr-bg, #060a14); color: var(--clr-text, #e4e6ea); font-size: 16px;
    font-family: var(--font-primary, 'DM Sans', sans-serif); outline: none; margin-bottom: 8px; box-sizing: border-box;
  }
  .dob-input:focus { border-color: var(--clr-gold, #f0a500); }

  .dob-error { color: #ef4444; font-size: 12px; margin: 4px 0 12px; text-align: left; }

  .dob-btn {
    width: 100%; padding: 12px; border: none; border-radius: 10px;
    background: var(--clr-gold, #f0a500); color: #000; font-weight: 700; font-size: 15px;
    cursor: pointer; font-family: var(--font-primary, 'DM Sans', sans-serif); margin-top: 8px;
    transition: opacity 0.15s;
  }
  .dob-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .dob-btn:hover:not(:disabled) { opacity: 0.9; }

  .dob-note { font-size: 12px; color: var(--clr-text-muted, #606770); margin-top: 16px; }

  @media (max-width: 480px) {
    .dob-card { border-radius: 12px; padding: 28px 20px; }
    .dob-card h2 { font-size: 20px; }
  }
</style>
