"use client";

import { useState } from "react";
import { Eye, EyeOff, Package, Shield, TrendingUp, Users } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { FormStack } from "@/components/forms/form-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

type Props = {
  loginAction: (formData: FormData) => void | Promise<void>;
  nextPath: string | undefined;
  isDevelopment: boolean;
  appVersion: string;
};

export function LoginClient({ loginAction, nextPath, isDevelopment, appVersion }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      {/* Animated neon backdrop — three orbs drift on a 18s loop, scanline drift on a 12s loop. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="fx-orb fx-orb-drift" style={{ top: "-10%", left: "-12%", width: "55vmax", height: "55vmax", background: "radial-gradient(closest-side, rgba(0,240,255,0.55), transparent)" }} />
        <div className="fx-orb fx-orb-drift" style={{ bottom: "-15%", right: "-10%", width: "60vmax", height: "60vmax", background: "radial-gradient(closest-side, rgba(255,0,170,0.45), transparent)", animationDelay: "-6s" }} />
        <div className="fx-orb fx-orb-drift" style={{ top: "30%", right: "20%", width: "32vmax", height: "32vmax", background: "radial-gradient(closest-side, rgba(34,255,136,0.32), transparent)", animationDelay: "-12s" }} />
        <div className="absolute inset-0 fx-scanline" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Branding — desktop */}
          <div className="hidden space-y-8 lg:block">
            <div className="flex items-center gap-3 fx-rise">
              <div className="fx-ring-grad relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-card/60 shadow-lg shadow-primary/20 backdrop-blur transition-transform duration-300 ease-out motion-safe:hover:scale-[1.04]">
                <Package className="h-8 w-8 text-primary" aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  <span className="fx-text-grad">IPTV Billing</span>
                </h1>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 fx-pulse-dot" aria-hidden />
                  Management System — Online
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-2xl font-semibold leading-snug text-foreground fx-rise" style={{ animationDelay: "60ms" }}>
                Comprehensive IPTV <br />
                Operations Platform
              </h2>
              <ul className="space-y-4 fx-rise-stagger">
                <li className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30 shadow-md shadow-primary/10">
                    <Users className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Subscriber Operations</p>
                    <p className="text-base text-muted-foreground">Complete lifecycle management from creation to renewal.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-400/30 shadow-md shadow-violet-500/10">
                    <TrendingUp className="h-5 w-5 text-violet-300" aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Credit Management</p>
                    <p className="text-base text-muted-foreground">Hierarchical credit distribution and tracking.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 ring-1 ring-pink-400/30 shadow-md shadow-pink-500/10">
                    <Shield className="h-5 w-5 text-pink-300" aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">STB Monitoring</p>
                    <p className="text-base text-muted-foreground">Real-time device status and control.</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDevelopment ? (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                  Development Environment
                </span>
              ) : null}
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/30">v{appVersion}</span>
            </div>
          </div>

          {/* Card + mobile brand */}
          <div className="w-full lg:mx-auto lg:max-w-xl">
            <div
              className={cn(
                "fx-ring-grad fx-rise relative rounded-xl border border-border/60 bg-card/80 p-7 text-card-foreground shadow-2xl shadow-primary/10 backdrop-blur-md sm:p-9",
                "transition-shadow duration-300 ease-out motion-safe:hover:shadow-cyan-500/15",
              )}
            >
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <div className="fx-ring-grad relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card/60">
                  <Package className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="text-xl font-bold"><span className="fx-text-grad">IPTV Billing</span></p>
                  <p className="text-sm text-muted-foreground">Management System</p>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
                <p className="text-base text-muted-foreground">Sign in to access your account</p>
              </div>

              <form action={loginAction} className="mt-6">
                <FormStack>
                  {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
                  <FormField id="login-username" label="Username">
                    <Input
                      id="login-username"
                      name="username"
                      required
                      autoComplete="username"
                      placeholder="Enter your username"
                    />
                  </FormField>
                  <FormField id="login-password" label="Password">
                    <div className="relative">
                      <Input
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                      <Checkbox defaultChecked={false} />
                      <span>Remember me</span>
                    </label>
                    <span
                      className="cursor-default text-primary underline-offset-2 hover:underline"
                      title="Password reset is not available in this build. Contact your administrator."
                    >
                      Forgot password?
                    </span>
                  </div>

                  <Button type="submit" className="fx-shine mt-1 w-full shadow-lg shadow-primary/25">
                    Sign in
                  </Button>

                  <div className="mt-6 rounded-lg border border-border/80 bg-muted/40 p-4 transition-colors duration-200">
                    <p className="text-sm font-semibold text-foreground">Sign-in note:</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Use your active billing account credentials. Authentication is validated against local database users (not your{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">DATABASE_*</code> connection user).
                    </p>
                  </div>
                </FormStack>
              </form>
            </div>

            <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 fx-pulse-dot" aria-hidden />
              Secured connection — AES-GCM payload obfuscation enabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
