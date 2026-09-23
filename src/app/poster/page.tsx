"use client";
import React, { useState, useRef } from "react";
import Link from "next/link";
import { useAppContext, Comment } from "../store";

function PublicCommentSection({ itemId }: { itemId: string }) {
  const { publicComments, addPublicComment } = useAppContext();
  const comments: Comment[] = publicComments[itemId] ?? [];
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addPublicComment(itemId, text, author || "Anonymous");
    setText(""); setAuthor("");
    textRef.current?.focus();
  };

  return (
    <div className="border-t border-neutral-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full px-5 py-3 text-sm text-neutral-500 hover:text-white transition-colors"
        aria-expanded={open}
      >
        <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="font-semibold">Public Comments</span>
        <span className="ml-auto bg-neutral-800 text-neutral-400 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">{comments.length}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-neutral-800 pt-4 flex flex-col gap-4">
          {comments.length === 0 ? (
            <p className="text-xs text-neutral-600 italic text-center py-2">No comments yet — be the first!</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md shadow-fuchsia-900/40">
                    {c.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-[#0a0a0a] border border-neutral-800 rounded-2xl px-3.5 py-2.5 shadow-sm">
                    <div className="flex gap-2 items-baseline mb-0.5">
                      <span className="text-xs font-bold text-white">{c.author}</span>
                      <span className="text-[10px] text-neutral-600">{new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm text-neutral-300 leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <input type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name (optional)"
              className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-600 transition-colors shadow-inner" />
            <div className="flex gap-2">
              <textarea ref={textRef} value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment…" rows={2}
                className="flex-1 bg-[#0a0a0a] border border-neutral-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-fuchsia-600 transition-colors resize-none shadow-inner" />
              <button type="submit" disabled={!text.trim()}
                className="self-end px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full font-bold text-sm shadow-lg shadow-fuchsia-900/40 hover:-translate-y-0.5 hover:shadow-fuchsia-900/60 active:translate-y-0 transition-all">
                Post
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function PosterDashboard() {
  const { lostItems } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-50 font-sans">
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-[#0a0a0a] border-b border-neutral-800 px-4 py-3 flex items-center justify-between shadow-lg shadow-black/40">
        <span className="font-bold text-fuchsia-400 tracking-tight text-[15px]">📌 PosterPanel</span>
        <button onClick={() => setSidebarOpen(o => !o)} className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center shadow-md transition-all" aria-label="Menu">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-20 flex">
          <div className="w-64 bg-neutral-900 border-r border-neutral-800 p-5 flex flex-col gap-3 shadow-2xl shadow-black/60">
            <p className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Quick Actions</p>
            <Link href="/poster/lost-item" onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-4 rounded-full shadow-lg shadow-fuchsia-900/40 transition-all hover:-translate-y-0.5 text-sm">
              <span>+</span> Lost Item Report
            </Link>
            <Link href="/poster/request-help" onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-full shadow-lg shadow-amber-900/40 transition-all hover:-translate-y-0.5 text-sm">
              <span>+</span> Help Request
            </Link>
            <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1">
              {["Posted", "History"].map(item => (
                <a key={item} href="#" className="px-4 py-2 rounded-full text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all">{item}</a>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-60 border-r border-neutral-800 bg-neutral-900 p-5 flex-col gap-4 sticky top-0 h-screen shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-fuchsia-900/40">
              <span className="text-white text-xs font-black">P</span>
            </div>
            <span className="font-bold text-white text-[15px] tracking-tight">PosterPanel</span>
          </div>

          <Link href="/poster/lost-item"
            className="flex items-center justify-center gap-2 w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-2.5 rounded-full shadow-lg shadow-fuchsia-900/40 hover:shadow-fuchsia-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm">
            + Lost Item Report
          </Link>
          <Link href="/poster/request-help"
            className="flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-full shadow-lg shadow-amber-900/40 hover:shadow-amber-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm">
            + Help Request
          </Link>

          <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-3 mb-1">Navigation</p>
            {["Posted", "History"].map(item => (
              <a key={item} href="#" className="px-4 py-2.5 rounded-full text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all font-medium">{item}</a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Lost &amp; Found</h1>
              <p className="text-neutral-500 text-sm mt-1.5">Items reported by students on campus.</p>
            </header>

            {/* Quick action cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <Link href="/poster/lost-item"
                className="group p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-fuchsia-600 shadow-lg shadow-black/30 hover:shadow-fuchsia-900/20 hover:-translate-y-0.5 transition-all">
                <div className="w-8 h-8 bg-fuchsia-600 rounded-xl flex items-center justify-center mb-3 shadow-md shadow-fuchsia-900/40 group-hover:scale-110 transition-transform">
                  <span className="text-white text-base">🔍</span>
                </div>
                <p className="font-bold text-white text-sm">Report Lost Item</p>
                <p className="text-xs text-neutral-500 mt-0.5">Create a report</p>
              </Link>
              <Link href="/poster/request-help"
                className="group p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-amber-600 shadow-lg shadow-black/30 hover:shadow-amber-900/20 hover:-translate-y-0.5 transition-all">
                <div className="w-8 h-8 bg-amber-600 rounded-xl flex items-center justify-center mb-3 shadow-md shadow-amber-900/40 group-hover:scale-110 transition-transform">
                  <span className="text-white text-base">🙏</span>
                </div>
                <p className="font-bold text-white text-sm">Request Help</p>
                <p className="text-xs text-neutral-500 mt-0.5">Find a helper</p>
              </Link>
            </div>

            {/* Feed */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold tracking-widest text-neutral-500 uppercase">Recent Lost Items</h2>
                <div className="flex-1 h-px bg-neutral-800" />
                <span className="text-xs text-neutral-600 font-mono">{lostItems.length}</span>
              </div>

              {lostItems.length === 0 ? (
                <div className="py-14 text-center bg-neutral-900 border border-dashed border-neutral-800 rounded-2xl shadow-inner">
                  <p className="text-3xl mb-3">📭</p>
                  <p className="text-neutral-400 font-semibold text-sm">No lost items yet</p>
                  <p className="text-neutral-600 text-xs mt-1 mb-4">Be the first to report a lost item</p>
                  <Link href="/poster/lost-item"
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-full text-sm shadow-lg shadow-fuchsia-900/40 hover:-translate-y-0.5 transition-all">
                    Create Report →
                  </Link>
                </div>
              ) : (
                lostItems.map(item => (
                  <article key={item.id}
                    className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-lg shadow-black/40 hover:shadow-black/60 hover:-translate-y-0.5 transition-all"
                    style={{ borderLeft: "3px solid #c026d3" }}>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-base font-extrabold text-white leading-tight">{item.itemName}</h3>
                          <p className="text-[11px] text-neutral-600 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                        <span className="px-3 py-1 bg-fuchsia-600 text-white text-[11px] font-bold rounded-full shadow-md shadow-fuchsia-900/40 shrink-0">Lost</span>
                      </div>
                      <p className="text-sm text-neutral-300 leading-relaxed mb-4">{item.description}</p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 shadow-sm">
                          <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wide mb-1">📍 Location</p>
                          <p className="text-sm text-white font-semibold">{item.location}</p>
                        </div>
                        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 shadow-sm">
                          <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wide mb-1">🕐 When</p>
                          <p className="text-sm text-white font-semibold">{new Date(item.lostTime).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3.5 py-2.5 shadow-sm">
                        <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-wide">📞 Contact</span>
                        <span className="text-sm text-white font-semibold ml-auto">{item.contactNumber}</span>
                      </div>
                    </div>
                    <PublicCommentSection itemId={item.id} />
                  </article>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
