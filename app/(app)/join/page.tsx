// app/(app)/join/page.tsx
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, PlayCircle } from "lucide-react";

import { joinSessionByCode } from "@/lib/sessionsRuntime";
import { getErrorMessage } from "@/lib/errors";
import { validateJoinCode } from "@/lib/validators";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function joinErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "Join failed");
  if (message === "Not authenticated" || message === "Guest join is unavailable right now.") {
    return "Guest join is unavailable right now. Try again in a moment or use a participant account.";
  }
  return message;
}

function HeaderActions() {
  const headerLinkClass = "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm font-semibold text-[color:var(--studio-muted)] transition hover:border-[var(--studio-border-strong)] hover:text-foreground";

  return (
    <header className="mx-auto flex w-full max-w-[1040px] justify-end gap-2 px-5 py-4 sm:px-6">
      <a href="mailto:decisionary.app@gmail.com" className={headerLinkClass}>
        <Mail className="mr-1.5 h-3.5 w-3.5 stroke-[1.8]" />
        Contact
      </a>
      <Link href="/login" className={headerLinkClass}>
        Sign in
      </Link>
    </header>
  );
}

function TurnstileChallenge({
  onToken,
  onReady,
}: {
  onToken: (token: string | null) => void;
  onReady: (reset: () => void) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey || !containerRef.current) return;
    const siteKey = turnstileSiteKey;

    let cancelled = false;
    let pollId: number | null = null;

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        size: "normal",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
      onReady(() => {
        onToken(null);
        window.turnstile?.reset(widgetIdRef.current ?? undefined);
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile"]');
      const script = existingScript ?? document.createElement("script");
      if (!existingScript) {
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
      pollId = window.setInterval(renderWidget, 250);
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onReady, onToken]);

  if (!turnstileSiteKey) return null;

  return (
    <div className="border-t border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Security check</div>
          <div className="mt-0.5 text-xs leading-5 text-[color:var(--studio-muted2)]">
            Complete once before joining.
          </div>
        </div>
        <div ref={containerRef} className="min-h-[65px] sm:min-w-[300px]" />
      </div>
    </div>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const joinCodeId = useId();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const resetCaptchaRef = useRef<() => void>(() => undefined);

  const handleCaptchaReady = useCallback((reset: () => void) => {
    resetCaptchaRef.current = reset;
  }, []);

  function requireCaptcha() {
    if (!turnstileSiteKey || captchaToken) return true;
    setError("Complete the security check first.");
    return false;
  }

  async function onJoin(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();

    const validCode = validateJoinCode(code);
    if (!validCode.ok) {
      setError(validCode.error);
      return;
    }
    if (!requireCaptcha()) return;

    setLoading(true);
    setError(null);

    try {
      const sessionId = await joinSessionByCode(validCode.value, captchaToken ?? undefined);
      router.push(`/sessions/${sessionId}`);
    } catch (e: unknown) {
      setError(joinErrorMessage(e));
      resetCaptchaRef.current();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--studio-bg)] text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),var(--studio-page-end))]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,hsl(var(--primary)/0.045),transparent_34%,hsl(176_58%_46%/0.05)_68%,transparent)]" />
      <div className="relative">
        <HeaderActions />

        <section className="mx-auto flex min-h-[calc(100vh-4.25rem)] w-full max-w-[1040px] flex-col items-center justify-center px-5 pb-8 pt-2 sm:px-6">
          <div className="mb-5 flex max-w-[760px] flex-col items-center text-center">
            <Link href="/" className="inline-flex items-center gap-4 text-foreground">
              <span className="grid h-14 w-14 place-items-center rounded-[14px] border border-white/24 bg-transparent text-xl font-bold text-white shadow-none sm:h-16 sm:w-16 sm:text-2xl">
                D
              </span>
              <span className="text-[30px] font-semibold leading-none tracking-[0] sm:text-[36px]">Decisionary</span>
            </Link>
            <p className="mt-2 text-sm leading-6 text-[color:var(--studio-muted)]">
              Practice the decisions before they become the day.
            </p>
          </div>

          <div className="w-full max-w-[520px] overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-[var(--studio-shadow2)]">
            <div className="border-b border-[var(--studio-border)] bg-[var(--studio-inset)] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-base font-semibold">
                <PlayCircle className="h-4 w-4 text-primary stroke-[1.8]" />
                Participant code
              </div>
              <p className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
                Enter the code shared by your facilitator.
              </p>
            </div>

            <form onSubmit={onJoin} className="space-y-3 p-4 sm:p-5">
              <div>
                <label htmlFor={joinCodeId} className="mb-1.5 block text-sm font-semibold leading-6 text-foreground">
                  Code
                </label>
                <Input
                  id={joinCodeId}
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoCapitalize="characters"
                  className="h-10 rounded-[8px]"
                />
              </div>

              {error ? (
                <div role="alert" aria-live="assertive" className="notice notice-error px-3 py-2 text-sm shadow-none">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="h-10 w-full rounded-[8px]" disabled={loading}>
                {loading ? "Joining..." : "Join session"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>

            <TurnstileChallenge
              onToken={setCaptchaToken}
              onReady={handleCaptchaReady}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
