"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ margin: 0, padding: "12vh 24px", background: "#f8f7f2", color: "#25251f", fontFamily: "Arial, sans-serif", textAlign: "center" }}><main><h1>Let’s try that again.</h1><p>Bachaoo hit an unexpected error. Please retry in a moment.</p><button onClick={reset} style={{ padding: "14px 24px", background: "#25251f", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>Reload this page</button></main></body></html>;
}
