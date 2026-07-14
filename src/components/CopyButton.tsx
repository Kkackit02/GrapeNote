"use client";

import { useState } from "react";

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-sm font-medium active:bg-violet-300"
    >
      {copied ? "복사됨 ✓" : label}
    </button>
  );
}
