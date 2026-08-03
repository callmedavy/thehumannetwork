import type { CommentNode, CommentView, PostView } from "../types";

export function normalizeInstance(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }

  return "just now";
}

export function communityHandle(post: PostView) {
  try {
    const host = post.community.actor_id ? new URL(post.community.actor_id).host : "";
    return `!${post.community.name}${host ? `@${host}` : ""}`;
  } catch {
    return `!${post.community.name}`;
  }
}

export function postImage(post: PostView) {
  const candidates = [post.post.thumbnail_url, post.post.url];
  return candidates.find((url) => url && /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url)) ?? post.post.thumbnail_url;
}

export function publicPostUrl(instance: string, post: PostView) {
  return post.post.ap_id || `https://${instance}/post/${post.post.id}`;
}

export function titleGradient(title: string) {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = title.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(145deg, hsl(${hue} 65% 88%), hsl(${(hue + 48) % 360} 56% 72%))`;
}

export function isJwtCurrent(token: string | null) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp !== "number" || payload.exp * 1000 > Date.now();
  } catch {
    return true;
  }
}

export function buildCommentTree(comments: CommentView[]): CommentNode[] {
  const nodes = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((view) => nodes.set(view.comment.id, { ...view, replies: [] }));

  comments.forEach((view) => {
    const node = nodes.get(view.comment.id)!;
    const path = view.comment.path.split(".").filter(Boolean).map(Number);
    const parentId = path.length > 2 ? path[path.length - 2] : undefined;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent && parent.comment.id !== node.comment.id) parent.replies.push(node);
    else roots.push(node);
  });

  const sortByScore = (nodesToSort: CommentNode[]): CommentNode[] => nodesToSort
    .sort((first, second) => second.counts.score - first.counts.score || new Date(second.comment.published).getTime() - new Date(first.comment.published).getTime())
    .map((node) => ({ ...node, replies: sortByScore(node.replies) }));

  return sortByScore(roots);
}
