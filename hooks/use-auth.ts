"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

export function useUser() {
  return useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiFetch("/api/auth/me");
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json() as Promise<User>;
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Invalid credentials");
      }
      const user = await res.json();
      queryClient.setQueryData(["/api/auth/me"], user);
      return user as User;
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fullName: string;
      email: string;
      password: string;
    }) => {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to register");
      }
      const user = await res.json();
      queryClient.setQueryData(["/api/auth/me"], user);
      return user as User;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });
}
