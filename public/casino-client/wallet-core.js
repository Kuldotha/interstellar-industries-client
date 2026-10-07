// Wallet Standard, minimally: wallets announce themselves by event, the page collects them,
// connecting yields an account, and signing goes through the wallet's own feature. A wallet that
// is dismissed rejects with its own words, which are passed through — "you closed it" beats
// anything invented here.

// Localhost only, devnet only: a wallet for developing without an extension. See devwallet.js.


const wallets = [];
const waiters = [];
let connected = null;

const isSolana = (w) =>
  w && w.accounts && w.features && w.features['standard:connect'] &&
  (w.chains || []).some((c) => c.startsWith('solana:'));

function push(w) {
  try {
    if (!isSolana(w) || wallets.some((x) => x.name === w.name)) return;
    wallets.push(w);
    const waiting = waiters.splice(0);
    for (const f of waiting) f();
  } catch (_) { /* a wallet that throws on inspection is not one we can use */ }
}

const api = { register: (...ws) => ws.forEach(push) };
window.addEventListener('wallet-standard:register-wallet', (ev) => { try { ev.detail(api); } catch (_) {} });
try { window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api })); } catch (_) {}

/** The names of the wallets seen so far, in the order they announced themselves. */
export const walletNames = () => wallets.map((w) => w.name);

/** Their icons, as data: URIs, in the same order; empty where a wallet has none. */
export const walletIcons = () => wallets.map((w) => w.icon || '');

/** Resolves when the list grows past `since`, or at once if it already has. */
export const walletsChanged = (since) => new Promise((resolve) => {
  if (wallets.length !== since) return resolve();
  waiters.push(resolve);
});

/** Connects wallet `i`; resolves to the account's base58 address. */
export async function walletConnect(i) {
  const w = wallets[i];
  if (!w) throw new Error('No Solana wallet found — install one, then reload this page.');
  const r = await w.features['standard:connect'].connect();
  const accounts = r?.accounts?.length ? r.accounts : w.accounts;
  if (!accounts?.length) throw new Error('the wallet returned no account');
  connected = { wallet: w, account: accounts[0] };
  return accounts[0].address;
}

/**
 * Re-attaches to the wallet named `name` that already holds `address`; null when none does.
 *
 * A passive attach — a wallet already listing the account — is tried across every wallet, since
 * that prompts nothing. The active `connect({ silent: true })`, which some wallets (Brave among
 * them) honour by opening their UI, is reserved for the one wallet the player chose, so a wallet
 * they never picked is never poked on reload.
 */
export async function walletSilentConnect(address, name) {
  for (const w of wallets) {
    const acc = (w.accounts || []).find((a) => a.address === address);
    if (acc) { connected = { wallet: w, account: acc }; return address; }
  }
  const w = name ? wallets.find((x) => x.name === name) : null;
  const f = w?.features['standard:connect'];
  if (!f) return null;
  try {
    const r = await f.connect({ silent: true });
    const acc = (r?.accounts ?? w.accounts ?? []).find((a) => a.address === address);
    if (acc) { connected = { wallet: w, account: acc }; return address; }
  } catch (_) { /* it declined to reconnect without asking */ }
  return null;
}

/** Signs a serialized transaction with the connected account; resolves to the signed bytes. */
export async function walletSignTransaction(bytes, chain) {
  if (!connected) throw new Error('no wallet connected');
  const f = connected.wallet.features['solana:signTransaction'];
  if (!f) throw new Error(`${connected.wallet.name} cannot sign transactions`);
  const out = await f.signTransaction({ transaction: bytes, account: connected.account, chain });
  const signed = out?.[0]?.signedTransaction;
  if (!signed) throw new Error('the wallet returned no transaction');
  return signed;
}

/** Signs raw bytes with the connected account; resolves to the 64-byte signature. */
export async function walletSignMessage(bytes) {
  if (!connected) throw new Error('no wallet connected');
  const f = connected.wallet.features['solana:signMessage'];
  if (!f) throw new Error(`${connected.wallet.name} cannot sign messages`);
  const out = await f.signMessage({ account: connected.account, message: bytes });
  const sig = out?.[0]?.signature;
  if (!sig) throw new Error('the wallet returned no signature');
  return sig;
}

export async function walletDisconnect() {
  const c = connected;
  connected = null;
  try { await c?.wallet?.features?.['standard:disconnect']?.disconnect(); } catch (_) {}
}
