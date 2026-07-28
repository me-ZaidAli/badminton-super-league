"use client";

import { useState } from "react";
import { Link, useLocation } from "@/lib/routing";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRegister } from "@/hooks/use-auth";

export default function Register() {
  const [, setLoc] = useLocation();
  const { toast } = useToast();
  const register = useRegister();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!fullName.trim()) next.fullName = "Full name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";
    else if (password.length < 8)
      next.password = "Use at least 8 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    register.mutate(
      { fullName, email, password },
      {
        onSuccess: () => setLoc("/"),
        onError: (err: any) =>
          toast({
            title: "Registration failed",
            description: err?.message ?? "Please try again",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <BSLBackground />
      <div className="w-full max-w-md">
        <GlowPanel title="Create Account" tone="gold">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" style={{ color: BSL.muted }}>
                Full Name
              </Label>
              <Input
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName)
                    setErrors((p) => ({ ...p, fullName: undefined }));
                }}
                aria-invalid={!!errors.fullName}
                style={
                  errors.fullName ? { borderColor: BSL.danger } : undefined
                }
                data-testid="input-register-fullname"
              />
              {errors.fullName && (
                <p className="text-xs" style={{ color: BSL.danger }}>
                  {errors.fullName}
                </p>
              )}
            </div>
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
                data-testid="input-register-email"
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: undefined }));
                }}
                aria-invalid={!!errors.password}
                style={errors.password ? { borderColor: BSL.danger } : undefined}
                data-testid="input-register-password"
              />
              {errors.password && (
                <p className="text-xs" style={{ color: BSL.danger }}>
                  {errors.password}
                </p>
              )}
            </div>
            <ActionButton
              type="submit"
              variant="gold"
              fullWidth
              loading={register.isPending}
              testid="button-register-submit"
            >
              Create Account
            </ActionButton>
          </form>
          <p
            className="mt-4 text-sm text-center"
            style={{ color: BSL.muted }}
          >
            Already have an account?{" "}
            <Link
              href="/bsl/login"
              className="underline"
              style={{ color: BSL.gold }}
            >
              Sign In
            </Link>
          </p>
        </GlowPanel>
      </div>
    </div>
  );
}
