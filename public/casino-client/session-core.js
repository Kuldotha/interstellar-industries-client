// The session key: a non-extractable WebCrypto Ed25519 pair per wallet — usable from this origin,
// never readable. A kept login stores the pair in IndexedDB; otherwise it lives in this page's
// memory and a reload drops it. The vault is told it may consent to the ledger's debits for one
// game, so every play is signed here and the wallet is asked only for deposits and withdrawals. A
// lost key is harmless: the next session grants a new one. What bounds it is the ledger balance.

const STORE = 'sessionKeys';
const memory = new Map();
const slot = (db, owner) => `${db}|${owner}`;

const open = (db) => new Promise((resolve, reject) => {
  const req = indexedDB.open(db, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const request = (handle, mode, run) => new Promise((resolve, reject) => {
  const req = run(handle.transaction(STORE, mode).objectStore(STORE));
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const stored = async (db, owner) => {
  try { return (await request(await open(db), 'readonly', (s) => s.get(owner))) ?? null; } catch (_) { return null; }
};

async function pair(db, owner, persist) {
  const held = memory.get(slot(db, owner));
  if (held) return held;
  // A login that is not kept never picks up a stored key: that one is permanent on chain.
  let kp = persist ? await stored(db, owner) : null;
  if (!kp) {
    kp = await crypto.subtle.generateKey('Ed25519', false, ['sign']);
    if (persist) await request(await open(db), 'readwrite', (s) => s.put(kp, owner));
  }
  memory.set(slot(db, owner), kp);
  return kp;
}

const raw = async (kp) => new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));

/**
 * The public key of `owner`'s session key in database `db`, creating the pair on first use —
 * stored in IndexedDB when `persist`, in this page's memory otherwise.
 */
export async function sessionPublicKey(db, owner, persist) {
  return raw(await pair(db, owner, persist));
}

/** Signs `message` with `owner`'s session key in database `db`; 64 bytes. */
export async function sessionSign(db, owner, message) {
  const kp = await pair(db, owner, false);
  return new Uint8Array(await crypto.subtle.sign('Ed25519', kp.privateKey, message));
}

/** The public key of a pair this browser stored for `owner`, or null: never makes one. */
export async function sessionRemembered(db, owner) {
  const kp = await stored(db, owner);
  return kp ? raw(kp) : null;
}

/** Destroys `owner`'s session key in IndexedDB, and in memory too when `everywhere` — on logout. */
export async function sessionForget(db, owner, everywhere) {
  if (everywhere) memory.delete(slot(db, owner));
  try { await request(await open(db), 'readwrite', (s) => s.delete(owner)); } catch (_) { /* nothing held */ }
}
