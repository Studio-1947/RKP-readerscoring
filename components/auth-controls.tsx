"use client";
/* eslint-disable @next/next/no-img-element -- Auth-provider avatars use user-controlled remote URLs. */

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, LogIn, LogOut, UserRound, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

type Props = { hindi: boolean; onAuthenticated: () => Promise<void> | void; onProfile: () => void };

export function AuthControls({ hindi, onAuthenticated, onProfile }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  function applyUser(user: { email?: string | null; is_anonymous?: boolean; user_metadata?: Record<string, unknown> } | null) {
    setSignedIn(Boolean(user && !user.is_anonymous));
    setEmailAddress(user?.email ?? "");
    setAvatarUrl(typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "");
  }

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => applyUser(data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      applyUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        void onAuthenticated();
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [onAuthenticated]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const supabase = createClient();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage(hindi ? "अपने ईमेल में भेजे गए पुष्टिकरण लिंक को खोलें।" : "Check your email and open the confirmation link.");
        return;
      }
      const session = result.data.session;
      if (session?.access_token) await fetch("/api/profile/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      await onAuthenticated(); setOpen(false); setPassword("");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to continue."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    // Optimistically reset UI state instantly
    applyUser(null);
    setAccountMenuOpen(false);
    
    // Clear client session and trigger server-side logout endpoint concurrently
    const supabase = createClient();
    const sessionData = await supabase.auth.getSession().catch(() => null);
    const token = sessionData?.data?.session?.access_token;

    await Promise.all([
      supabase.auth.signOut({ scope: "local" }).catch(() => null),
      token ? fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => null) : Promise.resolve(),
    ]);

    await onAuthenticated();
  }

  return <>
    {signedIn ? <div className="account-menu-wrap"><button type="button" onClick={() => setAccountMenuOpen((value) => !value)} className="account-avatar" aria-label={hindi ? "खाता मेनू" : "Account menu"} aria-expanded={accountMenuOpen}>{avatarUrl ? <img src={avatarUrl} alt="" onError={() => setAvatarUrl("")} /> : emailAddress.slice(0, 1).toUpperCase()}</button>{accountMenuOpen && <div className="account-menu" role="menu"><p>{emailAddress}</p><button type="button" onClick={() => { setAccountMenuOpen(false); onProfile(); }} role="menuitem"><UserRound className="size-4" />{hindi ? "प्रोफ़ाइल" : "Profile"}</button><button type="button" onClick={() => void signOut()} role="menuitem"><LogOut className="size-4" />{hindi ? "साइन आउट" : "Sign out"}</button></div>}</div> : <button type="button" onClick={() => setOpen(true)} className="reader-auth-button" aria-label={hindi ? "साइन इन" : "Sign in"}><LogIn className="size-4" /><span>{hindi ? "साइन इन" : "Sign in"}</span></button>}
    {open && createPortal(<div className="auth-dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label={hindi ? "खाता" : "Account"} className="auth-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-7 w-auto text-[#b42332] dark:text-[#fceeed]" />
            <div>
              <p className="padhaku-eyebrow">{hindi ? "आपका खाता" : "YOUR ACCOUNT"}</p>
              <h2 className="serif text-2xl font-bold">{mode === "signin" ? (hindi ? "साइन इन करें" : "Sign in") : (hindi ? "खाता बनाएँ" : "Create account")}</h2>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-900/5"><X className="size-5" /></button>
        </div>
        <form onSubmit={submit} className="mt-5 grid gap-4"><label className="text-sm font-semibold text-stone-700">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-input" /></label><label className="text-sm font-semibold text-stone-700">{hindi ? "पासवर्ड" : "Password"}<span className="password-input-wrap"><input required minLength={6} type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (hindi ? "पासवर्ड छिपाएँ" : "Hide password") : (hindi ? "पासवर्ड दिखाएँ" : "Show password")} className="password-toggle">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>{message && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#b42332]" role="alert">{message}</p>}<button disabled={busy} className="rounded-full bg-[#b42332] px-5 py-3 font-bold text-white">{busy ? (hindi ? "कृपया प्रतीक्षा करें…" : "Please wait…") : mode === "signin" ? (hindi ? "साइन इन" : "Sign in") : (hindi ? "खाता बनाएँ" : "Create account")}</button></form>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="mt-4 text-sm font-bold text-[#b42332]">{mode === "signin" ? (hindi ? "नया खाता बनाएँ" : "Create a new account") : (hindi ? "पहले से खाता है? साइन इन करें" : "Already have an account? Sign in")}</button>
      </section>
    </div>, document.body)}
  </>;
}
