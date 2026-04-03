/**
 * E2E Encryption store for Wisers DMs using tweetnacl (X25519 + XSalsa20-Poly1305).
 * Keys stored in localStorage. Graceful fallback to plaintext if keys unavailable.
 */
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const PRIVATE_KEY_KEY = 'wisers_private_key';
const PUBLIC_KEY_KEY = 'wisers_public_key';

const keyCache: Record<string, Uint8Array> = {};

export function hasKeyPair(): boolean {
	return !!localStorage.getItem(PRIVATE_KEY_KEY);
}

export function generateAndStoreKeyPair(): { publicKey: string } {
	const kp = nacl.box.keyPair();
	localStorage.setItem(PRIVATE_KEY_KEY, encodeBase64(kp.secretKey));
	localStorage.setItem(PUBLIC_KEY_KEY, encodeBase64(kp.publicKey));
	return { publicKey: encodeBase64(kp.publicKey) };
}

export function getPublicKey(): string | null {
	return localStorage.getItem(PUBLIC_KEY_KEY);
}

function getPrivateKey(): Uint8Array | null {
	const s = localStorage.getItem(PRIVATE_KEY_KEY);
	return s ? decodeBase64(s) : null;
}

export async function fetchAndCachePublicKey(userId: string, token: string): Promise<Uint8Array | null> {
	if (keyCache[userId]) return keyCache[userId];
	try {
		const res = await fetch(`https://api-bscan.balancewises.io/api/keys/${userId}`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (!data.public_key) return null;
		const key = decodeBase64(data.public_key);
		keyCache[userId] = key;
		return key;
	} catch {
		return null;
	}
}

export function encryptMessage(
	plaintext: string,
	recipientPublicKey: Uint8Array
): { encrypted: string; nonce: string } | null {
	const sk = getPrivateKey();
	if (!sk) return null;
	const nonce = nacl.randomBytes(nacl.box.nonceLength);
	const msg = decodeUTF8(plaintext);
	const box = nacl.box(msg, nonce, recipientPublicKey, sk);
	if (!box) return null;
	return { encrypted: encodeBase64(box), nonce: encodeBase64(nonce) };
}

export function decryptMessage(
	encryptedB64: string,
	nonceB64: string,
	senderPublicKey: Uint8Array
): string | null {
	const sk = getPrivateKey();
	if (!sk) return null;
	try {
		const enc = decodeBase64(encryptedB64);
		const nonce = decodeBase64(nonceB64);
		const dec = nacl.box.open(enc, nonce, senderPublicKey, sk);
		return dec ? encodeUTF8(dec) : null;
	} catch {
		return null;
	}
}

export async function uploadPublicKey(token: string): Promise<boolean> {
	const pk = getPublicKey();
	if (!pk) return false;
	try {
		const res = await fetch('https://api-bscan.balancewises.io/api/keys/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ public_key: pk })
		});
		return res.ok;
	} catch {
		return false;
	}
}

export function encryptPrivateKeyWithPassphrase(passphrase: string): string | null {
	const sk = getPrivateKey();
	if (!sk) return null;
	const pw = decodeUTF8(passphrase.padEnd(32, '\0').slice(0, 32));
	const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
	const encrypted = nacl.secretbox(sk, nonce, pw);
	const combined = new Uint8Array(nonce.length + encrypted.length);
	combined.set(nonce);
	combined.set(encrypted, nonce.length);
	return encodeBase64(combined);
}

export function decryptPrivateKeyWithPassphrase(encryptedB64: string, passphrase: string): boolean {
	try {
		const combined = decodeBase64(encryptedB64);
		const nonce = combined.slice(0, nacl.secretbox.nonceLength);
		const enc = combined.slice(nacl.secretbox.nonceLength);
		const pw = decodeUTF8(passphrase.padEnd(32, '\0').slice(0, 32));
		const dec = nacl.secretbox.open(enc, nonce, pw);
		if (!dec) return false;
		localStorage.setItem(PRIVATE_KEY_KEY, encodeBase64(dec));
		const kp = nacl.box.keyPair.fromSecretKey(dec);
		localStorage.setItem(PUBLIC_KEY_KEY, encodeBase64(kp.publicKey));
		return true;
	} catch {
		return false;
	}
}
