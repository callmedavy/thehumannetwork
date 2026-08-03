import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { login } from "../lib/lemmy";
import { normalizeInstance } from "../lib/format";
import { useAppStore } from "../store/useAppStore";

function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  action,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  action?: React.ReactNode;
  onBlur?: () => void;
}) {
  return (
    <label className="group relative block">
      <input
        required
        value={value}
        type={type}
        autoComplete={autoComplete}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="peer h-16 w-full rounded-2xl border border-line bg-panel/80 px-4 pb-2 pt-6 text-[15px] font-semibold outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/5 dark:focus:border-white"
      />
      <span className="pointer-events-none absolute left-4 top-2.5 text-[11px] font-bold uppercase tracking-[.15em] text-muted transition-all peer-placeholder-shown:top-[1.35rem] peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2.5 peer-focus:text-[11px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-[.15em]">
        {label}
      </span>
      {action}
    </label>
  );
}

export function LoginScreen() {
  const signIn = useAppStore((state) => state.signIn);
  const browse = useAppStore((state) => state.browse);
  const toast = useAppStore((state) => state.toast);
  const [instance, setInstance] = useState("lemmy.world");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeInstance(instance);
    if (!normalized) return;
    setLoading(true);
    try {
      const result = await login(normalized, username.trim(), password, totp || undefined);
      if (!result.jwt) throw new Error("This account requires email verification before signing in.");
      signIn(normalized, result.jwt);
      toast("Signed in. Happy swiping.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed.";
      if (/totp|2fa|two.factor/i.test(message)) {
        setNeedsTotp(true);
        toast("Enter the code from your authenticator app.", "neutral");
      } else {
        toast(message, "error");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grain relative grid min-h-[100dvh] place-items-center overflow-hidden px-5 py-10">
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-sprout/15 blur-3xl" />
      <div className="absolute bottom-[-8rem] right-[-7rem] h-80 w-80 rounded-full bg-amber-300/20 blur-3xl dark:bg-flare/10" />
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 25 }}
        className="relative w-full max-w-md rounded-[2rem] border border-white/60 bg-panel/75 p-6 shadow-card backdrop-blur-2xl sm:p-8 dark:border-white/5"
      >
        <div className="mb-9 flex items-start justify-between">
          <BrandMark />
          <span className="rounded-full border border-line bg-canvas/70 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-muted">Fediverse native</span>
        </div>
        <div className="mb-7">
          <h1 className="max-w-xs font-display text-[2.8rem] leading-[.95] tracking-[-.04em]">Your feed,<br /><em>felt differently.</em></h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">One post at a time. Less doomscrolling, more deliberate discovery.</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <FloatingInput label="Lemmy instance" value={instance} onChange={setInstance} onBlur={() => setInstance(normalizeInstance(instance))} autoComplete="url" />
          <FloatingInput label="Username or email" value={username} onChange={setUsername} autoComplete="username" />
          <FloatingInput
            label="Password"
            value={password}
            onChange={setPassword}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            action={(
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-4 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          />
          {needsTotp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <FloatingInput label="Authenticator code" value={totp} onChange={setTotp} autoComplete="one-time-code" />
            </motion.div>
          )}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-extrabold text-panel shadow-soft transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
          </motion.button>
        </form>

        <button type="button" onClick={() => browse(instance)} className="mx-auto mt-5 block text-sm font-semibold text-muted underline decoration-line underline-offset-4 transition hover:text-ink">
          Browse without account
        </button>
        <a href="https://whatislemmy.org" target="_blank" rel="noreferrer" className="mx-auto mt-3 flex w-fit items-center gap-1.5 text-xs font-bold text-muted transition hover:text-ink">
          Need Help? Visit Whatislemmy.org <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>

        <div className="mt-8 flex items-center gap-2 border-t border-line pt-5 text-xs leading-relaxed text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sprout" />
          Credentials go directly to your instance and never touch our servers.
        </div>
      </motion.section>
    </main>
  );
}
