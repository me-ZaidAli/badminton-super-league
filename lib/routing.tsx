"use client";

// Wouter-compatibility shim for Next.js App Router.
// Provides Link, useLocation, and useSearch with the same API as wouter,
// so BSL pages require only an import-path change.

import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

/** Drop-in for wouter's Link. Strips /bsl prefix from hrefs. */
export function Link({
  href,
  children,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  const cleanHref =
    typeof href === "string" ? href.replace(/^\/bsl/, "") || "/" : href;
  return (
    <NextLink href={cleanHref as string} {...props} legacyBehavior>
      {children}
    </NextLink>
  );
}

/**
 * Drop-in for wouter's useLocation.
 * Returns [currentPath, navigate] where currentPath has the /bsl prefix
 * restored for compatibility with code that checks against "/bsl/..." paths.
 */
export function useLocation(): [string, (path: string) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const bslPath = "/bsl" + pathname;
  const navigate = (path: string) => {
    const clean =
      typeof path === "string" ? path.replace(/^\/bsl/, "") || "/" : path;
    router.push(clean);
  };
  return [bslPath, navigate];
}

/**
 * Drop-in for wouter's useSearch.
 * Returns the raw query string (e.g. "?code=abc").
 */
export function useSearch(): string {
  const params = useSearchParams();
  const str = params.toString();
  return str ? "?" + str : "";
}

/**
 * Drop-in for wouter's useRoute.
 * In Next.js App Router, route params are passed via page props.
 * This shim uses usePathname to extract params from a pattern.
 * Usage: const [matched, params] = useRoute<{ id: string }>("/bsl/match/:id");
 */
export function useRoute<
  T extends Record<string, string> = Record<string, string>,
>(pattern: string): [boolean, T | null] {
  const pathname = usePathname();
  // Strip /bsl prefix from pattern for comparison
  const cleanPattern = pattern.replace(/^\/bsl/, "") || "/";
  const regex = new RegExp(
    "^" + cleanPattern.replace(/:([^/]+)/g, "(?<$1>[^/]+)") + "$",
  );
  const match =
    ("/" + pathname.replace(/^\//, "")).match(regex) ?? pathname.match(regex);
  if (!match) return [false, null];
  return [true, (match.groups ?? {}) as T];
}

/**
 * Drop-in for React Router / Next.js useParams.
 * Extracts dynamic segment params from the current pathname.
 * e.g. for route /admin/clubs/[id]/manage, returns { id: "123" }
 */
export function useParams<
  T extends Record<string, string> = Record<string, string>,
>(): T {
  const pathname = usePathname();
  // Extract all dynamic segments like [id] from the path
  // We use a generic approach: return segments that look like dynamic Next.js route params
  // by matching against common patterns in the URL
  const segments = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  // Heuristic: a segment that is all digits or a uuid is likely an :id param
  segments.forEach((seg, i) => {
    if (/^\d+$/.test(seg) || /^[0-9a-f-]{8,}$/.test(seg)) {
      params["id"] = seg;
    }
  });
  return params as T;
}
