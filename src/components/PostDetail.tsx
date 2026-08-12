import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, LoaderCircle, Maximize2, MessageCircle, Reply, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { CommentNode, CommentView, PostView } from "../types";
import { buildCommentTree, compactNumber, communityHandle, postImage, relativeTime } from "../lib/format";
import { createComment, listComments, voteComment, votePost } from "../lib/lemmy";
import { queueMarkAsRead } from "../lib/readTracking";
import { useAppStore } from "../store/useAppStore";
import { LoadingScreen } from "./LoadingScreen";

interface CommentProps {
  node: CommentNode;
  depth?: number;
  canVote: boolean;
  votingId: number | null;
  onVote: (comment: CommentView, score: -1 | 1) => void;
  onReply: (comment: CommentView, content: string) => Promise<boolean>;
}

function Comment({ node, depth = 0, canVote, votingId, onVote, onReply }: CommentProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const voting = votingId === node.comment.id;
  const showIndent = depth > 0 && depth <= 4;
  const unavailable = node.comment.deleted || node.comment.removed;

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim() || sendingReply) return;
    setSendingReply(true);
    const posted = await onReply(node, reply.trim());
    setSendingReply(false);
    if (posted) {
      setReply("");
      setReplying(false);
      setCollapsed(false);
    }
  }

  return (
    <article className={`min-w-0 max-w-full overflow-hidden ${showIndent ? "border-l border-line pl-3" : ""}`}>
      <div className="flex min-w-0 max-w-full items-start gap-2.5 py-3">
        <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-canvas text-[9px] font-extrabold uppercase">
          {node.creator.avatar ? <img src={node.creator.avatar} alt="" className="h-full w-full object-cover" /> : node.creator.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px]"><strong className="truncate">@{node.creator.name}</strong><span className="text-muted">{relativeTime(node.comment.published)}</span></div>
          <p className="mt-1 max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{unavailable ? "Comment unavailable" : node.comment.content}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-muted">
            <button type="button" onClick={() => onVote(node, 1)} disabled={!canVote || voting} className={`grid h-7 w-7 place-items-center rounded-full transition disabled:opacity-35 ${node.my_vote === 1 ? "bg-sprout text-white" : "bg-canvas hover:text-sprout"}`} aria-label={`Upvote comment by ${node.creator.name}`}><ArrowUp className="h-3.5 w-3.5" /></button>
            <span className="min-w-8 text-center">{compactNumber(node.counts.score)}</span>
            <button type="button" onClick={() => onVote(node, -1)} disabled={!canVote || voting} className={`grid h-7 w-7 place-items-center rounded-full transition disabled:opacity-35 ${node.my_vote === -1 ? "bg-flare text-white" : "bg-canvas hover:text-flare"}`} aria-label={`Downvote comment by ${node.creator.name}`}><ArrowDown className="h-3.5 w-3.5" /></button>
            {voting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            <button type="button" onClick={() => setReplying((value) => !value)} disabled={!canVote || unavailable} className="ml-1 flex h-7 items-center gap-1 rounded-full bg-canvas px-2.5 transition hover:text-ink disabled:opacity-35" aria-label={`Reply to ${node.creator.name}`}><Reply className="h-3.5 w-3.5" />Reply</button>
            {node.replies.length > 0 && <button type="button" onClick={() => setCollapsed((value) => !value)} className="ml-1 flex items-center gap-1 hover:text-ink"><ChevronDown className={`h-3 w-3 transition ${collapsed ? "-rotate-90" : ""}`} />{collapsed ? "Show" : "Hide"} {node.replies.length} replies</button>}
          </div>
          {replying && <form onSubmit={handleReply} className="mt-3 rounded-2xl border border-line bg-canvas p-2"><label className="sr-only" htmlFor={`reply-${node.comment.id}`}>Reply to {node.creator.name}</label><textarea id={`reply-${node.comment.id}`} value={reply} onChange={(event) => setReply(event.target.value)} rows={2} autoFocus placeholder={`Reply to @${node.creator.name}…`} className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted" /><div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => { setReplying(false); setReply(""); }} className="rounded-lg px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Cancel</button><button type="submit" disabled={!reply.trim() || sendingReply} className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-panel disabled:opacity-40">{sendingReply ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Post reply</button></div></form>}
        </div>
      </div>
      {!collapsed && node.replies.map((child) => <Comment key={child.comment.id} node={child} depth={depth + 1} canVote={canVote} votingId={votingId} onVote={onVote} onReply={onReply} />)}
    </article>
  );
}

export function PostDetail({ post, onClose, onPostVoted }: { post: PostView | null; onClose: () => void; onPostVoted?: (postId: number) => void }) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const savedIds = useAppStore((state) => state.savedIds);
  const toggleSaved = useAppStore((state) => state.toggleSaved);
  const syncSavedStatuses = useAppStore((state) => state.syncSavedStatuses);
  const toast = useAppStore((state) => state.toast);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [votingCommentId, setVotingCommentId] = useState<number | null>(null);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  useEffect(() => {
    if (!post) return;
    syncSavedStatuses([post]);
    setImageFullscreen(false);
    setLoading(true);
    listComments(instance, post.post.id, token)
      .then(setComments)
      .catch((error) => toast(error instanceof Error ? error.message : "Could not load comments.", "error"))
      .finally(() => setLoading(false));
  }, [post?.post.id, instance, token, syncSavedStatuses]);

  if (!post) return null;
  const image = postImage(post);
  const saved = savedIds.includes(post.post.id);

  async function handleVote(score: -1 | 1) {
    if (!token) return toast("Sign in to vote.");
    const postId = post!.post.id;
    onPostVoted?.(postId);
    onClose();
    try {
      await votePost(instance, postId, score, token);
      // A vote is intentional engagement: it also marks the post read, once the vote landed.
      queueMarkAsRead(postId);
      toast(score === 1 ? "Upvoted." : "Downvoted.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vote failed.", "error");
    }
  }

  async function handleComment(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !comment.trim()) return;
    setSending(true);
    try {
      const response = await createComment(instance, post!.post.id, comment.trim(), token);
      setComments((current) => [response.comment_view, ...current]);
      setComment("");
      toast("Comment posted.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Comment failed.", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleCommentVote(commentView: CommentView, requestedScore: -1 | 1) {
    if (!token) return toast("Sign in to vote on comments.");
    const score = commentView.my_vote === requestedScore ? 0 : requestedScore;
    setVotingCommentId(commentView.comment.id);
    try {
      const response = await voteComment(instance, commentView.comment.id, score, token);
      setComments((current) => current.map((item) => item.comment.id === commentView.comment.id ? response.comment_view : item));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Comment vote failed.", "error");
    } finally {
      setVotingCommentId(null);
    }
  }

  async function handleReply(commentView: CommentView, content: string) {
    if (!token) {
      toast("Sign in to reply to comments.");
      return false;
    }
    try {
      const response = await createComment(instance, post!.post.id, content, token, commentView.comment.id);
      setComments((current) => [...current, response.comment_view]);
      toast("Reply posted.", "success");
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Reply failed.", "error");
      return false;
    }
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-40 overflow-x-hidden bg-[#03120d]/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.65 }} onDragEnd={(_, info) => { if (info.offset.y > 140) onClose(); }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute inset-x-0 bottom-0 mx-auto flex h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-line bg-panel shadow-card"
          role="dialog" aria-modal="true" aria-labelledby="post-detail-title"
        >
          <div className="safe-top z-20 flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel px-4 pb-3">
            <span className="min-w-0 truncate rounded-full border border-line bg-canvas px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-muted">{communityHandle(post)}</span>
            <button type="button" onClick={onClose} className="shrink-0 rounded-full border border-line bg-canvas p-2.5 text-muted transition hover:text-ink" aria-label="Close post"><X className="h-5 w-5" /></button>
          </div>
          <div className="hide-scrollbar min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            {image && <button type="button" onClick={() => setImageFullscreen(true)} className="group relative block w-full bg-canvas" aria-label="View image full screen"><img src={image} alt="" className="h-auto w-full" /><span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white opacity-90 backdrop-blur-xl transition group-hover:bg-black/70"><Maximize2 className="h-4 w-4" /></span></button>}
            <div className="min-w-0 max-w-full overflow-x-hidden px-5 pb-8 pt-6 sm:px-8">
              <p className="max-w-full truncate text-xs font-bold text-muted">@{post.creator.name} · {relativeTime(post.post.published)}</p>
              <h2 id="post-detail-title" className="mt-2 max-w-full break-words text-3xl font-extrabold leading-[1.05] tracking-[-.04em] [overflow-wrap:anywhere] sm:text-4xl">{post.post.name}</h2>
              {post.post.body && <div className="markdown-body mt-5 text-sm leading-7 text-ink/85"><ReactMarkdown>{post.post.body}</ReactMarkdown></div>}
              {post.post.url && !image && <a href={post.post.url} target="_blank" rel="noreferrer" className="mt-5 block overflow-hidden text-ellipsis rounded-2xl border border-line bg-canvas p-4 text-xs font-bold text-sprout underline">{post.post.url}</a>}
              <div className="mt-8 flex items-center gap-4 border-y border-line py-4 text-xs font-bold text-muted"><span>{compactNumber(post.counts.score)} points</span><span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{compactNumber(post.counts.comments)} comments</span></div>
              <section className="min-w-0 max-w-full overflow-hidden pt-5"><h3 className="font-display text-2xl">Conversation</h3>{loading ? <LoadingScreen label="Loading conversation" className="py-5" /> : tree.length ? <div className="mt-2 min-w-0 max-w-full divide-y divide-line overflow-hidden">{tree.map((node) => <Comment key={node.comment.id} node={node} canVote={Boolean(token)} votingId={votingCommentId} onVote={handleCommentVote} onReply={handleReply} />)}</div> : <p className="py-10 text-center text-sm text-muted">Quiet in here. Start something thoughtful.</p>}</section>
            </div>
          </div>
          <div className="safe-bottom border-t border-line bg-panel/95 px-4 pt-3 backdrop-blur-xl">
            {token && <form onSubmit={handleComment} className="mb-3 flex items-center gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add to the conversation…" aria-label="Comment" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-ink" /><button type="submit" disabled={sending || !comment.trim()} aria-label="Post comment" className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-panel disabled:opacity-40">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form>}
            <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => handleVote(-1)} disabled={!token} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-canvas text-xs font-extrabold text-flare disabled:opacity-35"><ArrowDown className="h-4 w-4" />Down</button><button type="button" onClick={() => toggleSaved(post.post.id)} disabled={!token} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-extrabold disabled:opacity-35 ${saved ? "bg-ink text-panel" : "bg-canvas"}`}><Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />Save</button><button type="button" onClick={() => handleVote(1)} disabled={!token} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-canvas text-xs font-extrabold text-sprout disabled:opacity-35"><ArrowUp className="h-4 w-4" />Up</button></div>
          </div>
        </motion.section>
        <AnimatePresence>
          {imageFullscreen && image && (
            <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[#03120d]/95 p-3 safe-bottom safe-top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Full-screen post image" onClick={() => setImageFullscreen(false)}>
              <motion.img src={image} alt="" className="max-h-full max-w-full object-contain" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
              <button type="button" onClick={() => setImageFullscreen(false)} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white backdrop-blur-xl" aria-label="Close full-screen image"><X className="h-5 w-5" /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
