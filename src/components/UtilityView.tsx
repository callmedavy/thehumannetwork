import { useEffect, useState } from "react";
import { ArrowLeft, Check, Menu, Radio, Shield, Smartphone, Waves } from "lucide-react";
import type { ThemePreference } from "../types";
import { useAppStore } from "../store/useAppStore";
import { getProfile } from "../lib/lemmy";

export function UtilityView({ view }: { view: "profile" | "settings" | "about" }) {
  const setView = useAppStore((state) => state.setView);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const logout = useAppStore((state) => state.logout);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const haptics = useAppStore((state) => state.haptics);
  const setHaptics = useAppStore((state) => state.setHaptics);
  const [profile, setProfile] = useState<{ person: { name: string; display_name?: string; avatar?: string }; local_user: { email?: string } } | null>(null);

  useEffect(() => {
    if (view !== "profile" || !token) return;
    getProfile(instance, token).then((result) => setProfile(result ?? null)).catch(() => setProfile(null));
  }, [view, instance, token]);

  const titles = { profile: "Profile", settings: "Settings", about: "About" };
  return (
    <main className="min-h-[100dvh]">
      <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-canvas/80 px-4 pb-3 backdrop-blur-xl"><div className="mx-auto flex max-w-xl items-center justify-between"><button type="button" onClick={() => setView("feed")} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></button><h1 className="font-display text-2xl">{titles[view]}</h1><button type="button" onClick={() => setMenuOpen(true)} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Open menu"><Menu className="h-5 w-5" /></button></div></header>
      <section className="mx-auto max-w-xl px-5 py-8 safe-bottom">
        {view === "profile" && <div><div className="rounded-[2rem] bg-ink p-6 text-panel shadow-card">{profile?.person.avatar ? <img src={profile.person.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-panel/10 text-2xl font-display">{profile?.person.name?.slice(0, 1).toUpperCase() ?? "S"}</span>}<h2 className="mt-5 font-display text-4xl">{profile?.person.display_name || profile?.person.name || (token ? "Connected human" : "Quiet observer")}</h2><p className="mt-2 text-sm text-panel/65">{profile?.person.name ? `@${profile.person.name}${profile.local_user.email ? ` · ${profile.local_user.email}` : ""}` : token ? "Your identity stays with your Lemmy instance." : "You’re browsing in read-only mode."}</p><div className="mt-6 rounded-2xl bg-panel/10 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-panel/50">Home instance</p><p className="mt-1 font-extrabold uppercase tracking-[.08em]">{instance}</p></div></div><button type="button" onClick={logout} className="mt-4 w-full rounded-2xl border border-line bg-panel py-3.5 text-sm font-extrabold text-flare">{token ? "Log out" : "Change instance"}</button></div>}
        {view === "settings" && <div className="space-y-5"><section className="rounded-[1.5rem] border border-line bg-panel p-5 shadow-soft"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-canvas"><Smartphone className="h-5 w-5" /></span><div><h2 className="font-extrabold">Appearance</h2><p className="text-xs text-muted">Choose how Swimmey meets the light.</p></div></div><div className="mt-5 grid grid-cols-3 gap-2">{(["light", "dark", "auto"] as ThemePreference[]).map((option) => <button key={option} type="button" onClick={() => setTheme(option)} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-extrabold capitalize ${theme === option ? "border-ink bg-ink text-panel" : "border-line bg-canvas text-muted"}`}>{theme === option && <Check className="h-3.5 w-3.5" />}{option}</button>)}</div></section><section className="flex items-center justify-between rounded-[1.5rem] border border-line bg-panel p-5 shadow-soft"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-canvas"><Waves className="h-5 w-5" /></span><div><h2 className="font-extrabold">Haptic taps</h2><p className="text-xs text-muted">A tiny pulse on committed swipes.</p></div></div><button type="button" onClick={() => setHaptics(!haptics)} aria-label="Toggle haptics" aria-pressed={haptics} className={`relative h-7 w-12 rounded-full transition ${haptics ? "bg-sprout" : "bg-line"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${haptics ? "translate-x-5" : "translate-x-1"}`} /></button></section></div>}
        {view === "about" && <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-sprout">A slower social ritual</p><h2 className="mt-2 font-display text-5xl leading-[.95] tracking-[-.04em]">Less feed.<br /><em>More feeling.</em></h2><p className="mt-6 text-sm leading-7 text-muted">Swimmey is a focused window into Lemmy: one post, one choice, no algorithm pretending to know your soul. Your instance, credentials, saves, and preferences stay in your browser.</p><div className="mt-8 grid gap-3"><div className="flex gap-3 rounded-2xl bg-panel p-4 shadow-soft"><Radio className="h-5 w-5 text-sprout" /><div><h3 className="text-sm font-extrabold">Federated by design</h3><p className="mt-1 text-xs leading-relaxed text-muted">Connect to the Lemmy community you already call home.</p></div></div><div className="flex gap-3 rounded-2xl bg-panel p-4 shadow-soft"><Shield className="h-5 w-5 text-sprout" /><div><h3 className="text-sm font-extrabold">Private by default</h3><p className="mt-1 text-xs leading-relaxed text-muted">No tracking account, no server-side profile, no data brokerage.</p></div></div></div><p className="mt-8 text-xs font-bold text-muted">Swimmey 1.0 · Made for the open social web.</p></div>}
      </section>
    </main>
  );
}
