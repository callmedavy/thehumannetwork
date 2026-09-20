import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, BookOpen, Check, Globe2, Heart, Menu, Shield, Sparkles, Users } from "lucide-react";
import { BrandMark } from "./BrandMark";

const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

export function HomeScreen({ onGetStarted, onLogin }: { onGetStarted: () => void; onLogin: () => void }) {
  return (
    <main className="grain overflow-hidden">
      <nav className="safe-top mx-auto flex max-w-7xl items-center justify-between px-5 pb-4 pt-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-2.5">
          <BrandMark compact />
          <span className="hidden max-w-[9rem] font-display text-xl leading-[.9] tracking-[-.04em] sm:block">The Human Network</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onGetStarted} className="rounded-full bg-ink px-4 py-2.5 text-sm font-extrabold text-panel shadow-soft transition hover:-translate-y-0.5">Get started</button>
          <button type="button" onClick={onLogin} className="rounded-full px-4 py-2.5 text-sm font-bold text-muted transition hover:bg-panel hover:text-ink">Log in</button>
          <button type="button" aria-label="Open menu" className="hidden rounded-full border border-line p-2.5 text-muted"><Menu className="h-4 w-4" /></button>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-36 lg:pt-28">
        <div className="pointer-events-none absolute -left-32 top-8 h-80 w-80 rounded-full bg-sprout/20 blur-3xl" />
        <motion.div initial="hidden" animate="show" variants={reveal} className="relative">
          <p className="mb-6 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-sprout"><span className="h-2 w-2 rounded-full bg-sprout" /> News by the people</p>
          <h1 className="max-w-3xl font-display text-[4.2rem] leading-[.88] tracking-[-.055em] sm:text-7xl lg:text-[7.25rem]">Join the <em className="text-sprout">human</em> conversation.</h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted sm:text-xl">Discover what people everywhere are seeing, questioning, and changing. A global conversation shaped by us—not chosen for us.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onGetStarted} className="group flex h-14 items-center justify-center gap-3 rounded-2xl bg-ink px-6 text-sm font-extrabold text-panel shadow-soft transition hover:-translate-y-1">Get started <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
            <button type="button" onClick={onLogin} className="flex h-14 items-center justify-center rounded-2xl border border-line px-6 text-sm font-bold transition hover:border-ink hover:bg-panel">I already have an account</button>
          </div>
           <a href="#learn-more" className="mt-8 flex w-fit items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-muted transition hover:text-ink">Scroll to learn more <ArrowDown className="h-4 w-4" /></a>
          <div className="mt-9 flex items-center gap-3 text-xs text-muted"><div className="flex -space-x-2"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-canvas bg-flare text-[10px] font-black text-ink">M</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-canvas bg-sprout text-[10px] font-black text-panel">J</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-canvas bg-wash-two text-[10px] font-black text-ink">R</span></div><span>One world. Millions of voices. A human network.</span></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: .94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: .9, delay: .15 }} className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <div className="absolute -inset-5 rounded-[3rem] bg-sprout/10 blur-2xl" />
          <div className="relative rotate-2 rounded-[2rem] border border-line bg-panel p-3 shadow-card transition hover:rotate-0">
            <div className="rounded-[1.35rem] border border-line bg-canvas p-5">
              <div className="mb-8 flex items-center justify-between"><span className="text-xs font-bold text-muted">THE HUMAN NETWORK</span><span className="rounded-full bg-sprout/15 px-2.5 py-1 text-[10px] font-bold text-sprout">TODAY</span></div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-muted">From the global commons</p>
              <h2 className="mt-3 font-display text-3xl leading-tight">What is your community doing that the rest of the world should know about?</h2>
              <div className="mt-7 border-l-2 border-sprout pl-4 text-sm leading-relaxed text-muted">“Our neighbors turned an empty lot into a free kitchen. Three nearby communities are building their own now.”</div>
              <div className="mt-8 flex items-center justify-between border-t border-line pt-4 text-xs font-bold text-muted"><span>!community · 184 comments</span><Heart className="h-4 w-4 text-flare" /></div>
            </div>
            <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-extrabold uppercase tracking-[.15em] text-muted"><ArrowDown className="h-3 w-3" /> swipe to meet the next one</div>
          </div>
        </motion.div>
      </section>

      <section id="learn-more" className="scroll-mt-6 border-y border-line bg-panel/45 px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: .3 }} variants={reveal}><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-flare">Beyond the headlines</p><h2 className="mt-4 max-w-md font-display text-5xl leading-[.94] tracking-[-.04em] sm:text-6xl">Don’t just watch the world. <em>Join it.</em></h2></motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [BookOpen, "News from the source", "Hear from the people living the story—not only the institutions reporting on it. Context travels farther when everyone can contribute."],
              [Users, "The global town square", "Discover communities across borders, compare perspectives, and find the people already working on what matters to you."],
              [Heart, "Conversation into action", "Share knowledge, organize support, and turn common concern into practical change—locally or across the world."],
              [Sparkles, "Human in every direction", "Serious does not mean joyless. Find art, humor, hobbies, and everyday life alongside the conversations shaping our future."]
            ].map(([Icon, title, body], index) => {
              const FeatureIcon = Icon as typeof BookOpen;
              return <motion.article key={title as string} initial="hidden" whileInView="show" viewport={{ once: true, amount: .2 }} variants={{ ...reveal, show: { ...reveal.show, transition: { ...reveal.show.transition, delay: index * .08 } } }} className="rounded-3xl border border-line bg-canvas/60 p-6"><FeatureIcon className="h-5 w-5 text-sprout" /><h3 className="mt-7 text-lg font-extrabold">{title as string}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{body as string}</p></motion.article>;
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: .3 }} variants={reveal} className="grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-end">
          <div><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-sprout">Democratic news sorting</p><h2 className="mt-5 max-w-2xl font-display text-5xl leading-[.92] tracking-[-.045em] sm:text-7xl">The people decide what deserves to be heard.</h2></div>
          <p className="max-w-md text-base leading-relaxed text-muted">Every swipe is a small democratic choice. Together, upvotes, downvotes, and passes help communities surface what matters without forcing every person to care about the same things.</p>
        </motion.div>
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {[["01", "Upvote", "This needs to be heard. An upvote helps a useful, important, or overlooked story reach more people."], ["02", "Downvote", "This is spam, breaks the community’s rules, or is ethically bankrupt. A downvote asks the community not to amplify it."], ["03", "Pass", "This belongs in the conversation, but it does not matter to you personally. Passing leaves it for the people it may matter to."]].map(([number, title, text]) => <motion.div key={number} initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal} className="border-t-2 border-sprout pt-5"><span className="font-mono text-sm text-sprout">{number}</span><h3 className="mt-16 font-display text-3xl">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted">{text}</p></motion.div>)}
        </div>
      </section>

      <section className="bg-[#9ed5a7] px-5 py-24 text-[#071c13] sm:px-8 lg:px-10 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_.8fr] lg:items-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal}><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#183d29]">The internet is still ours</p><h2 className="mt-5 max-w-3xl font-display text-5xl leading-[.9] tracking-[-.045em] sm:text-7xl">A free internet means no one gets to own your voice.</h2></motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal} className="space-y-5 text-sm font-medium leading-relaxed text-[#173524]"><p>Free does not just mean free of charge. It means the freedom to choose where you gather, who you trust, and how you participate—without asking one company for permission or surrendering your community when that company changes the rules.</p><p>The Human Network lives on an open protocol, not inside a platform owned by tech oligarchs. Anyone in the world can use it, build on it, or run a piece of it themselves. Your conversations are not inventory, and the communities you discover are not trapped behind one company’s walls.</p><p>Choose the instance that feels right, then discover and join conversations hosted across the wider federated network. You can always choose a different home later, even though accounts and history do not automatically move with you. The technology exists to protect the human part—not to own it.</p><div className="flex flex-wrap gap-2 pt-3">{["Open protocol", "Federated by design", "Self-hostable"].map((item) => <span key={item} className="flex items-center gap-2 rounded-full border border-[#173524]/35 px-3 py-2 text-xs font-extrabold"><Check className="h-3.5 w-3.5" />{item}</span>)}</div></motion.div>
        </div>
      </section>

      <section className="px-5 py-24 text-center sm:px-8 lg:py-36">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal}><Globe2 className="mx-auto h-7 w-7 text-flare" /><h2 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-[.92] tracking-[-.045em] sm:text-7xl">The world is already talking. Add your voice.</h2><p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-muted">Discover the collective global conversation, find the communities moving it forward, and become part of what happens next.</p><button type="button" onClick={onGetStarted} className="mt-9 inline-flex h-14 items-center gap-3 rounded-2xl bg-ink px-7 text-sm font-extrabold text-panel shadow-soft transition hover:-translate-y-1">Get started <ArrowRight className="h-4 w-4" /></button></motion.div>
      </section>
      <footer className="border-t border-line px-5 py-8 text-center text-xs text-muted sm:px-8"><BrandMark compact /><p className="mt-4">News by the people. A network for humanity.</p></footer>
    </main>
  );
}