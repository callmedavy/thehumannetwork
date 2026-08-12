import { useEffect, useState } from "react";
import type { PostView, ThemePreference } from "./types";
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
import { PublishPostView } from "./components/PublishPostView";

const themeColors: Record<ThemePreference, string> = {
  forest: "#081D15",
  pink: "#FF4FA3",
  blue: "#082A63",
  tan: "#D8C39A",
  matrix: "#010803",
};

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[preference]);
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
  }, [theme]);

  if (!initialized) return <LoadingScreen label="Starting The Human Network" className="min-h-[100dvh] bg-canvas px-4" />;

  return (
    <div className="app-shell grain min-h-[100dvh] bg-canvas text-ink">
      {!instance ? <LoginScreen /> : (
        <>
          {view === "feed" && <FeedScreen onOpenPost={setSelectedPost} votedPostId={votedPostId} />}
          {view === "publish" && <PublishPostView onPublished={setSelectedPost} />}
          {view === "notifications" && <NotificationsView onOpenPost={setSelectedPost} />}
          {view === "saved" && <SavedView onOpenPost={setSelectedPost} />}
          {view === "upvoted" && <VoteHistoryView vote="up" onOpenPost={setSelectedPost} />}
          {view === "downvoted" && <VoteHistoryView vote="down" onOpenPost={setSelectedPost} />}
          {(view === "profile" || view === "settings" || view === "about") && <UtilityView view={view} onOpenPost={setSelectedPost} />}
          <FilterSheet />
          <MenuDrawer />
          {selectedPost && <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} onPostVoted={setVotedPostId} />}
        </>
      )}
      <ToastStack />
    </div>
  );
}
