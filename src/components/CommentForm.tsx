"use client";

import { useActionState, useEffect, useRef } from "react";
import { postComment } from "@/app/actions/comments";
import type { FormState } from "@/app/actions/auth";

const init: FormState = {};

export function CommentForm({ tapeId, comments, submissions }: { tapeId: number; comments: boolean; submissions: boolean }) {
  const [state, action, pending] = useActionState(postComment, init);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  if (!comments && !submissions) return <p className="mute">Posting is turned off right now.</p>;
  return (
    <form ref={ref} action={action} className="form wide">
      <input type="hidden" name="tape_id" value={tapeId} />
      <label>
        Post type
        <select name="kind" defaultValue={comments ? "comment" : "theory"}>
          {comments && <option value="comment">Comment (shows right away)</option>}
          {submissions && <option value="theory">Fan theory (reviewed first)</option>}
          {submissions && <option value="correction">Correction to this page (reviewed first)</option>}
        </select>
      </label>
      <label>
        Your post
        <textarea name="body" required minLength={3} maxLength={1500} placeholder="Keep it about the tape. No spoilers for other tapes without saying so." />
      </label>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg">{state.ok}</p>}
      <div><button className="btn fill" type="submit" disabled={pending}>{pending ? "Posting…" : "Post"}</button></div>
    </form>
  );
}
