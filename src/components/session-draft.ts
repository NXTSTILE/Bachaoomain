"use client";

import { useEffect, useState } from "react";

const prefix = "bachaoo:draft:";

export function clearSessionDrafts() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be unavailable in private browsers. */ }
}

// Drafts stay in this tab, are scoped to the member, and are removed after saving/logout.
export function useSessionDraft<T>(key: string, empty: T, validate: (value: unknown) => value is T) {
  const [snapshot, setSnapshot] = useState({ key, value: empty, ready: false });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      let value = empty;
      try {
        const stored: unknown = JSON.parse(sessionStorage.getItem(prefix + key) || "null");
        if (validate(stored)) value = stored;
      } catch { /* A corrupt or blocked draft must not prevent using the form. */ }
      if (active) setSnapshot({ key, value, ready: true });
    });
    return () => { active = false; };
  }, [key, empty, validate]);

  function update(value: T) {
    setSnapshot({ key, value, ready: true });
    try {
      if (JSON.stringify(value) === JSON.stringify(empty)) sessionStorage.removeItem(prefix + key);
      else sessionStorage.setItem(prefix + key, JSON.stringify(value));
    } catch { /* In-memory editing still works when storage is blocked/full. */ }
  }
  return [snapshot.key === key ? snapshot.value : empty, update, snapshot.key === key && snapshot.ready] as const;
}
