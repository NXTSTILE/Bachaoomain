"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../store";

export default function LostItemForm() {
  const router = useRouter();
  const { addLostItem } = useAppContext();
  const [formData, setFormData] = useState({ itemName: "", description: "", location: "", lostTime: "", contactNumber: "" });
  const set = (k: string, v: string) => setFormData(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addLostItem(formData);
    router.push("/poster");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg">
        <Link href="/poster" className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1.5 mb-5">
          ← Back to Dashboard
        </Link>

        <div className="mb-5">
          <div className="w-1 h-6 bg-fuchsia-500 rounded inline-block mr-3 align-middle" />
          <h1 className="inline text-xl font-bold align-middle">Report Lost Item</h1>
          <p className="text-neutral-500 text-sm mt-1.5">Fill in the details so others can help you find it.</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="itemName" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Item Name</label>
              <input id="itemName" type="text" required value={formData.itemName} onChange={e => set("itemName", e.target.value)}
                placeholder="e.g., Blue Backpack"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors" />
            </div>

            <div>
              <label htmlFor="description" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Description</label>
              <textarea id="description" required rows={3} value={formData.description} onChange={e => set("description", e.target.value)}
                placeholder="Identifiable details — colour, brand, contents…"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Location Lost</label>
                <input id="location" type="text" required value={formData.location} onChange={e => set("location", e.target.value)}
                  placeholder="e.g., Library 2nd Floor"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors" />
              </div>
              <div>
                <label htmlFor="lostTime" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Lost Time</label>
                <input id="lostTime" type="datetime-local" required value={formData.lostTime} onChange={e => set("lostTime", e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 transition-colors" />
              </div>
            </div>

            <div>
              <label htmlFor="contactNumber" className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1.5">Contact Number</label>
              <input id="contactNumber" type="tel" required value={formData.contactNumber} onChange={e => set("contactNumber", e.target.value)}
                placeholder="Your phone number"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-fuchsia-500 transition-colors" />
            </div>

            <button type="submit" className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 rounded-lg text-sm transition-colors mt-2">
              Submit Report →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
