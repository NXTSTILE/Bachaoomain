"use client";
import React, { useState, useRef } from "react";
import { useAppContext, Comment } from "../store";

function PrivateChat({ requestId }: { requestId: string }) {
  const { privateComments, addPrivateComment } = useAppContext();
  const messages: Comment[] = privateComments[requestId] ?? [];
  const [text, setText] = useState("");
  const [senderRole, setSenderRole] = useState<"helper" | "poster">("helper");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addPrivateComment(requestId, text, senderRole === "helper" ? "Helper" : "Poster", senderRole);
    setText("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="border-t border-neutral-800 bg-[#0a0a0a]">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-800">
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/40 animate-pulse" />
        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Private Thread</span>
        <span className="ml-auto text-[10px] text-neutral-700 font-medium">🔒 Visible to poster &amp; helper only</span>
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-4 max-h-52 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-4">No messages yet. Start the conversation!</p>
        ) : (
          messages.map(msg => {
            const isHelper = msg.role === "helper";
            return (
              <div key={msg.id} className={`flex gap-2 ${isHelper ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-md ${isHelper ? "bg-indigo-600 text-white shadow-indigo-900/40" : "bg-fuchsia-600 text-white shadow-fuchsia-900/40"}`}>
                  {msg.author.charAt(0)}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-md text-sm ${isHelper ? "bg-indigo-600 text-white shadow-indigo-900/40 rounded-tr-sm" : "bg-neutral-800 text-neutral-100 shadow-black/30 rounded-tl-sm"}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${isHelper ? "text-indigo-200 text-right" : "text-neutral-500"}`}>
                    {msg.author} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-neutral-600 font-semibold">Chatting as:</span>
          {(["helper", "poster"] as const).map(role => (
            <button key={role} onClick={() => setSenderRole(role)}
              className={`text-xs px-3.5 py-1 rounded-full font-bold shadow-md transition-all hover:-translate-y-0.5 ${senderRole === role
                ? role === "helper" ? "bg-indigo-600 text-white shadow-indigo-900/40"
                  : "bg-fuchsia-600 text-white shadow-fuchsia-900/40"
                : "bg-neutral-800 text-neutral-500 hover:text-white shadow-black/20"}`}>
              {role === "helper" ? "🤝 Helper" : "📌 Poster"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…"
            className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-indigo-500 shadow-inner transition-colors" />
          <button type="submit" disabled={!text.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full font-bold text-sm shadow-lg shadow-indigo-900/40 hover:shadow-indigo-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default function HelperDashboard() {
  const { helpRequests, acceptedRequests, acceptRequest } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-50 font-sans">
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-[#0a0a0a] border-b border-neutral-800 px-4 py-3 flex items-center justify-between shadow-lg shadow-black/40">
        <span className="font-bold text-indigo-400 tracking-tight text-[15px]">🤝 HelperPanel</span>
        <button onClick={() => setSidebarOpen(o => !o)} className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center shadow-md transition-all" aria-label="Menu">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-20 flex">
          <nav className="w-64 bg-neutral-900 border-r border-neutral-800 p-5 flex flex-col gap-2 shadow-2xl shadow-black/60">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-3 mb-2">Navigation</p>
            {["Dashboard", "Task Completed", "Earnings"].map(item => (
              <a key={item} href="#" className="px-4 py-2.5 rounded-full text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all font-medium">{item}</a>
            ))}
          </nav>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-60 border-r border-neutral-800 bg-neutral-900 p-5 flex-col gap-4 sticky top-0 h-screen shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <span className="text-white text-xs font-black">H</span>
            </div>
            <span className="font-bold text-white text-[15px] tracking-tight">HelperPanel</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-3 mb-1">Navigation</p>
            {["Dashboard", "Task Completed", "Earnings"].map(item => (
              <a key={item} href="#" className="px-4 py-2.5 rounded-full text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all font-medium">{item}</a>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Helper Dashboard</h1>
              <p className="text-neutral-500 text-sm mt-1.5">Pick up tasks and help your fellow students.</p>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: "Active", value: String(acceptedRequests.size), color: "text-indigo-400", bg: "shadow-indigo-900/20" },
                { label: "Done", value: "0", color: "text-emerald-400", bg: "shadow-emerald-900/20" },
                { label: "Rating", value: "—", color: "text-amber-400", bg: "shadow-amber-900/20" },
              ].map((s, i) => (
                <div key={i} className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-lg ${s.bg}`}>
                  <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold mb-1.5">{s.label}</p>
                  <p className={`text-2xl sm:text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Requests */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold tracking-widest text-neutral-500 uppercase">Open Requests</h2>
                <div className="flex-1 h-px bg-neutral-800" />
                <span className="text-xs text-neutral-600 font-mono">{helpRequests.length}</span>
              </div>

              {helpRequests.length === 0 ? (
                <div className="py-14 text-center bg-neutral-900 border border-dashed border-neutral-800 rounded-2xl shadow-inner">
                  <p className="text-3xl mb-3">🙌</p>
                  <p className="text-neutral-400 font-semibold text-sm">No open requests right now</p>
                  <p className="text-neutral-600 text-xs mt-1">Check back soon — students need your help!</p>
                </div>
              ) : (
                helpRequests.map(req => {
                  const accepted = acceptedRequests.has(req.id);
                  return (
                    <article key={req.id}
                      className={`rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-lg shadow-black/40 hover:shadow-black/60 hover:-translate-y-0.5 transition-all ${accepted ? "border-l-indigo-500" : ""}`}
                      style={{ borderLeft: `3px solid ${accepted ? "#6366f1" : "#818cf8"}` }}>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="text-base font-extrabold text-white leading-tight">{req.problemSubject}</h3>
                            <p className="text-[11px] text-neutral-600 mt-0.5">{new Date(req.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="px-3 py-1 bg-amber-600 text-white text-[11px] font-bold rounded-full shadow-md shadow-amber-900/30">
                              Due {new Date(req.deadline).toLocaleDateString()}
                            </span>
                            {accepted && (
                              <span className="px-3 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-full shadow-md shadow-indigo-900/40">✓ Accepted</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-neutral-300 leading-relaxed mb-4">{req.details}</p>
                        {!accepted && (
                          <div className="flex justify-end">
                            <button onClick={() => acceptRequest(req.id)}
                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-sm shadow-lg shadow-indigo-900/40 hover:shadow-indigo-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all">
                              Accept Task →
                            </button>
                          </div>
                        )}
                      </div>
                      {accepted && <PrivateChat requestId={req.id} />}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
