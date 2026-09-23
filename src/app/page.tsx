"use client";
import React from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const handleAction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const role = new FormData(e.currentTarget).get("role");
    if (role === "helper") router.push("/helper");
    else if (role === "poster") router.push("/poster");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-[0_8px_32px_rgba(255,255,255,0.12)]">
            <span className="text-[#0a0a0a] font-black text-2xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bachaoo</h1>
          <p className="text-neutral-500 text-sm mt-1">Campus help &amp; lost-found platform</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          <form className="flex flex-col gap-4" onSubmit={handleAction}>
            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5">Registration No.</label>
              <input type="text" required placeholder="e.g. 1042301"
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-500 shadow-inner transition-all" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5">Full Name</label>
              <input type="text" required placeholder="John Doe"
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-500 shadow-inner transition-all" />
            </div>

            {/* Role selector */}
            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">I am a…</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer">
                  <input type="radio" name="role" value="helper" className="peer sr-only" defaultChecked />
                  <div className="rounded-2xl border border-neutral-800 py-3 text-center text-sm font-semibold text-neutral-500
                    peer-checked:border-indigo-500 peer-checked:bg-indigo-600 peer-checked:text-white
                    hover:border-neutral-600 hover:text-neutral-300 transition-all shadow-md shadow-black/30">
                    🤝 Helper
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="role" value="poster" className="peer sr-only" />
                  <div className="rounded-2xl border border-neutral-800 py-3 text-center text-sm font-semibold text-neutral-500
                    peer-checked:border-fuchsia-500 peer-checked:bg-fuchsia-600 peer-checked:text-white
                    hover:border-neutral-600 hover:text-neutral-300 transition-all shadow-md shadow-black/30">
                    📌 Poster
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5">Password</label>
              <input type="password" required placeholder="••••••••"
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-500 shadow-inner transition-all tracking-widest" />
            </div>

            <button type="submit"
              className="w-full bg-white text-[#0a0a0a] font-bold text-sm py-3.5 rounded-full shadow-[0_4px_24px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_32px_rgba(255,255,255,0.22)] hover:-translate-y-0.5 active:translate-y-0 transition-all mt-1">
              Get Started →
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-700 mt-5">Your campus, your community.</p>
      </div>
    </div>
  );
}
