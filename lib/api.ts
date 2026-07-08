// API client for BSL Hub.
// All requests are forwarded to the main Badminton Hub API server.
// Set NEXT_PUBLIC_API_URL in .env.local to point at the Express backend.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Fetch wrapper that:
 *  - Prepends the API base URL
 *  - Sends credentials (session cookie) on every request
 *  - Throws on non-ok responses with the server's JSON error message
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  return res;
}

/**
 * Default queryFn for TanStack Query.
 * Expects queryKey[0] to be the API path (e.g. "/api/bsl/league").
 */
export async function defaultQueryFn<T>({
  queryKey,
}: {
  queryKey: readonly unknown[];
}): Promise<T> {
  const path = queryKey[0] as string;
  const res = await apiFetch(path);
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
