"use client";

import { useState } from "react";
import { Link, useLocation, useSearch } from "@/lib/routing";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLogin } from "@/hooks/use-auth";

export default function Login() {
  const [, setLoc] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Proxy redirects unauthenticated visitors here with ?next=<original path>.
    const nextPath = new URLSearchParams(search).get("next");
    login.mutate(
      { email, password },
      {
        onSuccess: () =>
          setLoc(nextPath && nextPath.startsWith("/") ? nextPath : "/"),
        onError: (err: any) =>
          toast({
            title: "Login failed",
            description: err?.message ?? "Invalid credentials",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <BSLBackground />
      <div className="w-full max-w-md">
        <GlowPanel title="Sign In" tone="cyan">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" style={{ color: BSL.muted }}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                aria-invalid={!!errors.email}
                style={errors.email ? { borderColor: BSL.danger } : undefined}
                data-testid="input-login-email"
              />
              {errors.email && (
                <p className="text-xs" style={{ color: BSL.danger }}>
                  {errors.email}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" style={{ color: BSL.muted }}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: undefined }));
                }}
                aria-invalid={!!errors.password}
                style={errors.password ? { borderColor: BSL.danger } : undefined}
                data-testid="input-login-password"
              />
              {errors.password && (
                <p className="text-xs" style={{ color: BSL.danger }}>
                  {errors.password}
                </p>
              )}
            </div>
            <ActionButton
              type="submit"
              variant="cyan"
              fullWidth
              loading={login.isPending}
              testid="button-login-submit"
            >
              Sign In
            </ActionButton>
          </form>
          <p
            className="mt-4 text-sm text-center"
            style={{ color: BSL.muted }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/bsl/register"
              className="underline"
              style={{ color: BSL.cyan }}
            >
              Register
            </Link>
          </p>
        </GlowPanel>
      </div>
    </div>
  );
}
