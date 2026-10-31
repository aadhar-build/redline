// The origin the browser used for this request. Sign-in cookies belong to that host, so redirects after
// signing in or out must stay on it (request.url can name a different host, such as localhost for
// 127.0.0.1, when running with next start).
export function requestOrigin(request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return url.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
