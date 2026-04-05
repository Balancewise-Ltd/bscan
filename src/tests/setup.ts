import { vi, afterEach } from 'vitest';

// ── Mock localStorage ────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
	getItem: vi.fn((key: string) => store[key] ?? null),
	setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
	removeItem: vi.fn((key: string) => { delete store[key]; }),
	clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
	get length() { return Object.keys(store).length; },
	key: vi.fn((i: number) => Object.keys(store)[i] ?? null)
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ── Mock fetch ───────────────────────────────────────────
globalThis.fetch = vi.fn();

// ── Mock performance.now ─────────────────────────────────
if (!globalThis.performance) {
	(globalThis as any).performance = { now: vi.fn(() => Date.now()) };
}

// ── Mock requestAnimationFrame ───────────────────────────
globalThis.requestAnimationFrame = vi.fn((cb) => { cb(0); return 0; });

// ── Reset between tests ──────────────────────────────────
afterEach(() => {
	localStorageMock.clear();
	vi.clearAllMocks();
});
