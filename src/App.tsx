import { useEffect, useState } from "react";
import type { PostView } from "./types";
import { useAppStore } from "./store/useAppStore";
import { LoginScreen } from "./components/LoginScreen";
import { FeedScreen } from "./components/FeedScreen";
import { SavedView } from "./components/SavedView";
import { VoteHistoryView } from "./components/VoteHistoryView";
import { UtilityView } from "./components/UtilityView";
import { FilterSheet } from "./components/FilterSheet";
import { MenuDrawer } from "./components/MenuDrawer";
import { PostDetail } from "./components/PostDetail";
import { ToastStack } from "./components/ToastStack";
import { LoadingScreen } from "./components/LoadingScreen";
import { NotificationsView } from "./components/NotificationsView";

function applyTheme(preference: "light" | "dark" | "auto") {
  const isDark = preference === "dark" || (preference === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#051610" : "#081D15");
}

export default function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const initialized = useAppStore((state) => state.initialized);
  const instance = useAppStore((state) => state.instance);
  const theme = useAppStore((state) => state.theme);
  const view = useAppStore((state) => state.view);
  const [selectedPost, setSelectedPost] = useState<PostView | null>(null);
  const [votedPostId, setVotedPostId] = useState<number | null>(null);

  useEffect(() => hydrate(), [hydrate]);

  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => { if (theme === "auto") applyTheme(theme); };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  if (!initialized) return <LoadingScreen label="Starting Swimmey" className="min-h-[100dvh] bg-canvas px-4" />;

  return (
    <div className="grain min-h-[100dvh] bg-canvas text-ink">
      {!instance ? <LoginScreen /> : (
        <>
          {view === "feed" && <FeedScreen onOpenPost={setSelectedPost} votedPostId={votedPostId} />}
          {view === "notifications" && <NotificationsView onOpenPost={setSelectedPost} />}
          {view === "saved" && <SavedView onOpenPost={setSelectedPost} />}
          {view === "upvoted" && <VoteHistoryView vote="up" onOpenPost={setSelectedPost} />}
          {view === "downvoted" && <VoteHistoryView vote="down" onOpenPost={setSelectedPost} />}
          {(view === "profile" || view === "settings" || view === "about") && <UtilityView view={view} />}
          <FilterSheet />
          <MenuDrawer />
          {selectedPost && <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} onPostVoted={setVotedPostId} />}
        </>
      )}
      <ToastStack />
    </div>
  );
}
