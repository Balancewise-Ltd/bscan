// ── Plans & Billing ─────────────────────────────────────
export type Plan = 'guest' | 'free' | 'pro' | 'agency';
export type BillingInterval = 'monthly' | 'annual';

export interface PlanPricing {
	monthly: number;
	annual: number;
}

export const PLAN_PRICING: Record<'pro' | 'agency', PlanPricing> = {
	pro: { monthly: 9, annual: 7 },
	agency: { monthly: 29, annual: 23 }
};

export const PLAN_LIMITS: Record<Plan, { scans: number; label: string }> = {
	guest: { scans: 3, label: 'Free' },
	free: { scans: 3, label: 'Free' },
	pro: { scans: 30, label: 'Pro' },
	agency: { scans: Infinity, label: 'Agency' }
};

// ── Auth ─────────────────────────────────────────────────
export interface User {
	id: string;
	email: string;
	name?: string;
	plan: Plan;
	scans_this_month: number;
	created_at: string;
	team_id?: string;
	email_verified?: boolean;
	avatar_url?: string;
	billing_type?: string;
	plan_expires_at?: string;
	plan_source?: string;
}

export interface AuthState {
	user: User | null;
	token: string | null;
	loading: boolean;
}

// ── Scan ─────────────────────────────────────────────────
export type Severity = 'critical' | 'warning' | 'pass';
export type IssueCategory = 'seo' | 'performance' | 'accessibility' | 'security' | 'mobile' | 'links';

export interface ScanIssue {
	title: string;
	description: string;
	fix?: string;
	severity: Severity;
	category: IssueCategory;
}

export interface SSLDetails {
	ssl_grade: string;
	ssl_issuer?: string;
	ssl_days_remaining?: number;
}

export interface ServerLocation {
	server_country?: string;
	server_city?: string;
	server_isp?: string;
	server_ip?: string;
}

export interface GreenHosting {
	is_green: boolean;
	green_hosting_provider?: string;
}

export interface SafeBrowsing {
	safe_browsing_status: string;
	is_safe: boolean;
}

export interface WHOISData {
	domain_age_text?: string;
	is_new_domain?: boolean;
	registrar?: string;
	expiry_date?: string;
}

export interface Observatory {
	observatory_grade?: string;
	observatory_score?: number;
	observatory_tests_passed?: number;
}

export interface W3CValidation {
	html_valid: boolean;
	html_errors?: number;
	html_warnings?: number;
}

export interface WaybackData {
	has_archive: boolean;
	first_archived?: string;
	wayback_url?: string;
}

export interface TechStack {
	technologies: string[];
	tech_count: number;
	categories: {
		cms?: string;
		js_framework?: string;
		server?: string;
		cdn?: string;
		ecommerce?: string;
		analytics?: string;
	};
}

export interface Enrichment {
	ssl_details?: SSLDetails;
	server_location?: ServerLocation;
	green_hosting?: GreenHosting;
	safe_browsing?: SafeBrowsing;
	whois?: WHOISData;
	observatory?: Observatory;
	w3c_validation?: W3CValidation;
	wayback?: WaybackData;
	tech_stack?: TechStack;
	screenshot_url?: string;
}

export interface BusinessIntel {
	ctas?: { total_ctas: number; purchase_ctas?: string[]; signup_ctas?: string[] };
	payment_methods?: { methods: string[] };
	social_proof?: { score: number; signals: string[] };
	email_capture?: { methods: string[] };
	urgency_tactics?: { tactics: string[] };
	social_media?: { count: number; platforms: Record<string, string> };
	live_chat?: { has_live_chat: boolean; tools: string[] };
	pricing?: { prices_found: number; currency?: string; price_range?: string };
	keywords?: { top_words: string[]; h1_headings?: string[] };
}

export interface ConsumerIntel {
	reviews_ratings?: { has_reviews: boolean; review_platforms?: string[]; star_rating?: number };
	customer_support?: { score: number; channels: string[] };
	trust_signals?: { count: number; signals: string[] };
	loyalty_program?: { has_loyalty_program: boolean; program_type?: string[] };
	pricing_psychology?: { count: number; sophistication?: string; tactics?: string[] };
	delivery_shipping?: { signals: string[] };
	personalization?: { sophistication?: string; features?: string[] };
	return_policy?: { has_return_policy: boolean; signals?: string[] };
}

export interface Benchmarks {
	ux_patterns?: {
		total_detected: number;
		ux_score: number;
		all_patterns: Array<string | { name: string; pattern?: string }>;
	};
	industry?: {
		detected_industry?: string;
		industry_label?: string;
		comparisons?: Record<string, { score: number; industry_avg: number }>;
		summary?: string;
	};
}

export interface Achievement {
	id: string;
	title: string;
	description: string;
	icon: string;
	color: string;
}

export interface ChallengeData {
	domain: string;
	score: number;
	challenge_url: string;
	achievements: Achievement[];
	share_urls: {
		twitter?: string;
		linkedin?: string;
		whatsapp?: string;
		email?: string;
	};
}

export interface ScanResult {
	id: string;
	url: string;
	overall_score: number;
	seo_score: number;
	performance_score: number;
	accessibility_score: number;
	security_score: number;
	mobile_score: number;
	links_score: number;
	summary?: string;
	issues: ScanIssue[];
	enrichment: Enrichment;
	business_intel?: BusinessIntel;
	consumer_intel?: ConsumerIntel;
	benchmarks?: Benchmarks;
	created_at?: string;
}

export interface ScanCheckResult {
	can_scan: boolean;
	scans_remaining: number;
	scans_used: number;
	plan: Plan;
	has_account: boolean;
	message?: string;
}

// ── Scan Progress (real-time) ────────────────────────────
export interface ScanStep {
	index: number;
	text: string;
	progress: number;
	status: 'ok' | 'warn' | 'fail' | 'pending';
}

// ── Leaderboard ──────────────────────────────────────────
export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface LeaderboardEntry {
	domain: string;
	overall_score: number;
	seo_score?: number;
	security_score?: number;
}

// ── Team ─────────────────────────────────────────────────
export interface TeamMember {
	id: string;
	email: string;
	name?: string;
	role: 'owner' | 'admin' | 'member';
	status: 'active' | 'pending';
	joined_at?: string;
}

export interface TeamData {
	team: TeamMember[];
	max_members: number;
}

// ── Chat ─────────────────────────────────────────────────
export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp?: number;
}

// ── Score Categories ─────────────────────────────────────
export interface ScoreCategory {
	key: IssueCategory;
	label: string;
	icon: string;
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
	{ key: 'seo', label: 'SEO', icon: '🔍' },
	{ key: 'performance', label: 'Performance', icon: '⚡' },
	{ key: 'accessibility', label: 'Accessibility', icon: '♿' },
	{ key: 'security', label: 'Security', icon: '🔒' },
	{ key: 'mobile', label: 'Mobile', icon: '📱' },
	{ key: 'links', label: 'Links', icon: '🔗' }
];
