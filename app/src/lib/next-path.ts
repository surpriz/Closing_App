const BASE = "http://local.invalid";

// Where to go after signing in. Only same-site paths, so the login page can't be used
// as an open redirect. Resolving the URL catches tricks like "/\t/evil.example", which
// browsers read as "//evil.example".
export function safeNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`.slice(0, 512);
  } catch {
    return null;
  }
}
