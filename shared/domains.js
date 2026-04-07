/**
 * Normalize user/domain input to a bare hostname-style domain (no www).
 */
export function normalizeDomainInput(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim().toLowerCase();
  s = s.replace(/^@+/, '');
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0];
  s = s.split('?')[0];
  s = s.split('#')[0];
  s = s.split(':')[0];
  if (s.startsWith('www.')) s = s.slice(4);
  return s;
}

/**
 * True if page hostname matches a blocked entry (exact or subdomain).
 */
export function hostnameMatches(hostname, blockedDomain) {
  const h = (hostname || '').toLowerCase();
  const d = normalizeDomainInput(blockedDomain);
  if (!h || !d) return false;
  return h === d || h.endsWith('.' + d);
}

/**
 * Extract registrable-ish host from a full URL string.
 */
export function hostnameFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    return u.hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isExtensionUrl(urlString) {
  return typeof urlString === 'string' && urlString.startsWith('chrome-extension://');
}

export function uniqueDomains(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const d = normalizeDomainInput(raw);
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

/** True if hostname matches any entry in the list (normalized). */
export function domainInList(hostname, list) {
  if (!hostname || !list?.length) return false;
  return list.some((d) => hostnameMatches(hostname, d));
}

/**
 * Normalize a session allowlist from popup textarea (string) or structured input.
 */
export function parseAllowlistInput(raw) {
  if (typeof raw === 'string') {
    return uniqueDomains(raw.split(/[\n,]+/));
  }
  return uniqueDomains(Array.isArray(raw) ? raw : []);
}
