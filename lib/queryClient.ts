"use client";

import { QueryClient } from "@tanstack/react-query";
import { defaultQueryFn, apiFetch } from "./api";

// Singleton QueryClient shared across the app
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Drop-in for the main app's apiRequest helper.
 * Forwards to the API server with credentials.
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const res = await apiFetch(url, {
    method,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          message = json.message ?? json.error ?? text;
        } catch {
          message = text;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(`${res.status}: ${message}`);
  }

  return res;
}
