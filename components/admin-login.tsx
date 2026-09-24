"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Unable to sign in.");
      router.replace("/admin"); router.refresh();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to sign in."); } finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f7f5f0] p-5"><section className="w-full max-w-md overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/10"><div className="bg-[#25191b] px-7 py-8 text-white"><p className="text-xs font-bold tracking-[.22em] text-[#e5b043]">RAJKAMAL READER</p><h1 className="mt-3 text-3xl font-black">Admin sign in</h1><p className="mt-2 text-sm leading-6 text-stone-300">Use the single private admin email and password configured on this server.</p></div><form onSubmit={submit} className="space-y-5 p-7"><label className="block text-sm font-bold text-stone-700">Email address<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="admin-input" placeholder="admin@company.com" /></label><label className="block text-sm font-bold text-stone-700">Password<span className="relative mt-1 block"><input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="admin-input mt-0 pr-12" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1 grid size-10 place-items-center rounded-lg text-[#b42332] hover:bg-rose-50">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>{message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{message}</p>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b42332] px-5 py-3 font-bold text-white transition hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60"><LockKeyhole className="size-4" />{busy ? "Signing in…" : "Sign in securely"}</button></form><div className="border-t border-stone-100 bg-stone-50 px-7 py-5"><div className="flex items-start gap-3 text-xs leading-5 text-stone-600"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#b42332]" /><p>This private login is configured with <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code>. It does not create a reader account.</p></div><Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#b42332] hover:text-[#7e1421]"><ArrowLeft className="size-4" />Back to reader app</Link></div></section></main>;
}
