export type ThemePreference = "forest" | "pink" | "blue" | "tan" | "matrix";
export type FeedScope = "All" | "Subscribed";
export type SortOrder = "top" | "comments" | "contested";
export type DateRange = "today" | "week" | "month" | "year" | "all";
export type SwipeDirection = "left" | "right" | "down";
// Exactly one read-filtering path runs at a time:
// server  – the instance omits read posts (show_read=false)
// client  – the app drops post_views whose read flag is true
// session – the account auto-marks fetched posts, so only this session's dismissals are hidden
export type ReadFilterMode = "server" | "client" | "session";
export type ViewName = "feed" | "publish" | "notifications" | "saved" | "upvoted" | "downvoted" | "profile" | "settings" | "about";

export interface Filters {
  scope: FeedScope;
  order: SortOrder;
  date: DateRange;
}

export interface Person {
  id: number;
  name: string;
  avatar?: string;
  actor_id?: string;
  display_name?: string;
  bio?: string;
}

export interface Community {
  id: number;
  name: string;
  title: string;
  actor_id?: string;
  icon?: string;
}

export interface LemmyPost {
  id: number;
  name: string;
  body?: string;
  url?: string;
  thumbnail_url?: string;
  published: string;
  nsfw: boolean;
  ap_id?: string;
}

export interface Counts {
  comments: number;
  score: number;
  upvotes: number;
  downvotes: number;
}

export interface PostView {
  post: LemmyPost;
  creator: Person;
  community: Community;
  counts: Counts;
  read?: boolean;
  saved?: boolean;
  my_vote?: number | null;
}

export interface LemmyComment {
  id: number;
  content: string;
  path: string;
  published: string;
  deleted?: boolean;
  removed?: boolean;
}

export interface CommentView {
  comment: LemmyComment;
  creator: Person;
  counts: Counts;
  my_vote?: number | null;
}

export interface CommentNode extends CommentView {
  replies: CommentNode[];
}

export interface AccountNotification {
  id: string;
  kind: "reply" | "mention" | "message";
  creator: Person;
  content: string;
  published: string;
  read: boolean;
  post?: LemmyPost;
  community?: Community;
}

export interface ToastMessage {
  id: number;
  message: string;
  tone?: "neutral" | "success" | "error";
}
