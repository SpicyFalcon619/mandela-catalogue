"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { markRepliesRead } from "@/app/actions/comments";

export function MarkRepliesRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await markRepliesRead();
        router.refresh();
        setBusy(false);
      }}
    >
      Mark all as read
    </button>
  );
}
