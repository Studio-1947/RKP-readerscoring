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
  const [mode, setMode] = useState<"signin" | "signup" | "forgot-password" | "reset-password" | "otp-send" | "otp-verify">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
      let result: any;

      if (mode === "forgot-password") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        if (!res.ok) throw new Error("Failed to send reset instructions.");
        setMessage(hindi ? "पासवर्ड रीसेट लिंक भेज दिया गया है। टोकन दर्ज करें।" : "Password reset email sent. Please enter the token below.");
        setMode("reset-password");
        setBusy(false);
        return;
      }

      if (mode === "reset-password") {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, newPassword })
        });
        if (!res.ok) throw new Error("Failed to reset password.");
        setMessage(hindi ? "पासवर्ड सफलतापूर्वक रीसेट हो गया है। कृपया साइन इन करें।" : "Password reset successfully. You can now sign in.");
        setMode("signin");
        setBusy(false);
        return;
      }

      if (mode === "otp-send") {
        const res = await fetch("/api/auth/otp/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryCode: "+91", phone, email })
        });
        if (!res.ok) throw new Error("Failed to send OTP.");
        setMessage(hindi ? "OTP भेज दिया गया है। कृपया इसे नीचे दर्ज करें।" : "OTP sent successfully. Please enter it below.");
        setMode("otp-verify");
        setBusy(false);
        return;
      }

      if (mode === "otp-verify") {
        const res = await fetch("/api/auth/otp/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryCode: "+91", phone, email, otp })
        });
        result = await res.json();
        if (!res.ok) throw new Error(result.message || result.error || "Invalid OTP.");
      } else if (mode === "signin") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        result = await res.json();
        if (!res.ok) throw new Error(result.message || result.error || "Login failed on Rajkamal backend.");
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, firstName, lastName, phone })
        });
        result = await res.json();
        if (!res.ok && !result.message?.toLowerCase().includes("already exist")) {
           throw new Error(result.message || result.error || "Registration failed on Rajkamal backend.");
        }
      }
      
      const token = result?.token || result?.accessToken || result?.data?.token || result?.data?.accessToken;
      if (token && typeof window !== "undefined") {
        localStorage.setItem("rkp-token", token);
      }
      
      // Magic Sync: Set the Supabase session passed from the secure proxy
      if (result?.supabaseSession) {
         await supabase.auth.setSession(result.supabaseSession);
      }
      
      const sessionData = await supabase.auth.getSession().catch(() => null);
      if (sessionData?.data?.session?.access_token) {
        await fetch("/api/profile/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${sessionData.data.session.access_token}` } });
      }
      
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
    const rkpToken = typeof window !== "undefined" ? localStorage.getItem("rkp-token") : null;
    if (typeof window !== "undefined") localStorage.removeItem("rkp-token");

    await Promise.all([
      supabase.auth.signOut({ scope: "local" }).catch(() => null),
      token || rkpToken ? fetch("/api/auth/logout", { 
        method: "POST", 
        headers: { 
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(rkpToken ? { "x-rkp-token": rkpToken } : {})
        } 
      }).catch(() => null) : Promise.resolve(),
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
              <h2 className="serif text-2xl font-bold">
                {mode === "signin" ? (hindi ? "साइन इन करें" : "Sign in") : 
                 mode === "signup" ? (hindi ? "खाता बनाएँ" : "Create account") :
                 mode === "forgot-password" ? (hindi ? "पासवर्ड भूल गए" : "Forgot Password") :
                 mode === "reset-password" ? (hindi ? "पासवर्ड रीसेट करें" : "Reset Password") :
                 (hindi ? "OTP से साइन इन करें" : "Sign in with OTP")}
              </h2>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-900/5"><X className="size-5" /></button>
        </div>
        <form onSubmit={submit} className="mt-5 grid gap-4">
          
          {(mode === "signup" || mode === "otp-send" || mode === "otp-verify") && (
            <label className="text-sm font-semibold text-stone-700">{hindi ? "फ़ोन" : "Phone"}<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="auth-input" /></label>
          )}

          {mode === "signup" && (
            <>
              <label className="text-sm font-semibold text-stone-700">{hindi ? "पहला नाम" : "First Name"}<input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="auth-input" /></label>
              <label className="text-sm font-semibold text-stone-700">{hindi ? "अंतिम नाम" : "Last Name"}<input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="auth-input" /></label>
            </>
          )}

          {(mode === "signin" || mode === "signup" || mode === "forgot-password" || mode === "otp-send" || mode === "otp-verify") && (
            <label className="text-sm font-semibold text-stone-700">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-input" /></label>
          )}

          {mode === "reset-password" && (
            <>
              <label className="text-sm font-semibold text-stone-700">{hindi ? "रीसेट टोकन" : "Reset Token"}<input required type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} className="auth-input" /></label>
              <label className="text-sm font-semibold text-stone-700">{hindi ? "नया पासवर्ड" : "New Password"}<span className="password-input-wrap"><input required minLength={6} type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="auth-input" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password" className="password-toggle">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
            </>
          )}

          {mode === "otp-verify" && (
            <label className="text-sm font-semibold text-stone-700">OTP<input required type="text" value={otp} onChange={(e) => setOtp(e.target.value)} className="auth-input" /></label>
          )}

          {(mode === "signin" || mode === "signup") && (
            <label className="text-sm font-semibold text-stone-700">{hindi ? "पासवर्ड" : "Password"}<span className="password-input-wrap"><input required minLength={6} type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (hindi ? "पासवर्ड छिपाएँ" : "Hide password") : (hindi ? "पासवर्ड दिखाएँ" : "Show password")} className="password-toggle">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
          )}

          {message && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[#b42332]" role="alert">{message}</p>}
          
          <button disabled={busy} className="rounded-full bg-[#b42332] px-5 py-3 font-bold text-white">
            {busy ? (hindi ? "कृपया प्रतीक्षा करें…" : "Please wait…") : 
             mode === "forgot-password" ? (hindi ? "लिंक भेजें" : "Send Link") :
             mode === "reset-password" ? (hindi ? "पासवर्ड बदलें" : "Reset Password") :
             mode === "otp-send" ? (hindi ? "OTP भेजें" : "Send OTP") :
             mode === "otp-verify" ? (hindi ? "OTP सत्यापित करें" : "Verify OTP") :
             mode === "signin" ? (hindi ? "साइन इन" : "Sign in") : 
             (hindi ? "खाता बनाएँ" : "Create account")}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-3">
          {mode === "signin" && (
            <>
              <button type="button" onClick={() => { setMode("forgot-password"); setMessage(""); }} className="text-sm font-bold text-stone-500 hover:text-stone-800">{hindi ? "पासवर्ड भूल गए?" : "Forgot Password?"}</button>
              <button type="button" onClick={() => { setMode("otp-send"); setMessage(""); }} className="text-sm font-bold text-stone-500 hover:text-stone-800">{hindi ? "OTP से साइन इन करें" : "Sign in with OTP"}</button>
            </>
          )}
          
          {mode !== "signin" && mode !== "signup" && (
            <button type="button" onClick={() => { setMode("signin"); setMessage(""); }} className="text-sm font-bold text-stone-500 hover:text-stone-800">{hindi ? "वापस साइन इन पर जाएँ" : "Back to Sign in"}</button>
          )}

          <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }} className="text-sm font-bold text-[#b42332]">{mode === "signup" ? (hindi ? "पहले से खाता है? साइन इन करें" : "Already have an account? Sign in") : (hindi ? "नया खाता बनाएँ" : "Create a new account")}</button>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
