import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export function ToastStack() {
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 safe-bottom">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = toast.tone === "error" ? AlertCircle : toast.tone === "success" ? CheckCircle2 : Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-ink px-4 py-3 text-sm text-panel shadow-card"
              role="status"
            >
              <Icon className={`h-4 w-4 shrink-0 ${toast.tone === "error" ? "text-flare" : toast.tone === "success" ? "text-sprout" : "text-panel/70"}`} />
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification" className="rounded-full p-1 text-panel/60 hover:text-panel">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
