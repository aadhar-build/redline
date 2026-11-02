// The origin the browser used for this request. Sign-in cookies belong to that host, so redirects after
// signing in or out must stay on it (request.url can name a different host, such as localhost for
// 127.0.0.1, when running with next start).
const FALLBACK = "/library";

/**
 * A path on this site to send the Reviewer to after signing in, taken from the request. Anything that
 * could leave the site ("//host", "/\host", "https://host", a backslash or a control character
 * anywhere) falls back to /library.
 */
export function safeNextPath(value, origin) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return FALLBACK;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return FALLBACK;
  let base;
  let u;
  try {
    base = new URL(origin);
    u = new URL(value, base);
  } catch {
    return FALLBACK;
  }
  if (u.origin !== base.origin) return FALLBACK;
  const result = `${u.pathname}${u.search}${u.hash}`;
  // Check the output too: dot segments normalise "/.//evil.com" to "//evil.com", which is another host.
  if (!result.startsWith("/") || result.startsWith("//") || result.includes("\\")) return FALLBACK;
  if (new URL(result, base).origin !== base.origin) return FALLBACK;
  return result;
}

/** A full same-origin URL for a redirect target from the request, verified again before use. */
export function safeRedirectUrl(value, origin) {
  const url = new URL(safeNextPath(value, origin), origin);
  return url.origin === new URL(origin).origin ? url : new URL(FALLBACK, origin);
}

export function requestOrigin(request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return url.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
