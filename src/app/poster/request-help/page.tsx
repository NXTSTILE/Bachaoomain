"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../store";

export default function RequestHelpForm() {
  const router = useRouter();
  const { addHelpRequest } = useAppContext();
  const [formData, setFormData] = useState({ problemSubject: "", details: "", deadline: "" });
  const set = (k: string, v: string) => setFormData(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addHelpRequest(formData);
    router.push("/poster");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg">
        <Link href="/poster" className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1.5 mb-5">
          ← Back to Dashboard
        </Link>

        <div className="mb-5">
          <div className="w-1 h-6 bg-amber-500 rounded inline-block mr-3 align-middle" />
          <h1 className="inline text-xl font-bold align-middle">Request Help</h1>
          <p className="text-neutral-500 text-sm mt-1.5">Describe your problem — a helper will pick it up.</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="problemSubject" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Subject</label>
              <input id="problemSubject" type="text" required value={formData.problemSubject} onChange={e => set("problemSubject", e.target.value)}
                placeholder="Brief summary of what you need"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500 transition-colors" />
            </div>

            <div>
              <label htmlFor="details" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Details</label>
              <textarea id="details" required rows={4} value={formData.details} onChange={e => set("details", e.target.value)}
                placeholder="More context about the task or problem…"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500 transition-colors resize-none" />
            </div>

            <div>
              <label htmlFor="deadline" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Deadline</label>
              <input id="deadline" type="date" required value={formData.deadline} onChange={e => set("deadline", e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors" />
            </div>

            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg text-sm transition-colors mt-2">
              Submit Request →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
