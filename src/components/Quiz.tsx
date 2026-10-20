"use client";

import { useState } from "react";
import type { QuizQ } from "@/lib/content";

export function Quiz({ questions }: { questions: QuizQ[] }) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<number | null>(null);

  if (!questions.length) return <p className="mute">No questions yet.</p>;
  if (i >= questions.length) {
    const msg = score >= questions.length * 0.85 ? "Clean signal. You could run the archive." : score >= questions.length * 0.5 ? "Some tracking noise. Open the tapes and try again." : "Heavy static. Start with Vol. 1.";
    return (
      <div className="quiz">
        <div className="qhd"><span>RESULT</span><span>{score} / {questions.length}</span></div>
        <div className="q">{msg}</div>
        <button className="btn fill" type="button" onClick={() => { setI(0); setScore(0); setPick(null); }}>Rewind</button>
      </div>
    );
  }
  const q = questions[i];
  const answered = pick !== null;
  const answer = (n: number) => {
    if (answered) return;
    setPick(n);
    if (n === q.answer) setScore((s) => s + 1);
  };
  return (
    <div className="quiz">
      <div className="qhd"><span>QUESTION {i + 1} / {questions.length}</span><span>SCORE {score}</span></div>
      <div className="q">{q.question}</div>
      <div className="opts">
        {q.options.map((o, n) => (
          <button key={n} type="button" disabled={answered} className={`opt${answered && n === q.answer ? " ok" : ""}${answered && n === pick && n !== q.answer ? " no" : ""}`} onClick={() => answer(n)}>
            {o}
          </button>
        ))}
      </div>
      <div className="qnote" aria-live="polite">{answered ? `${pick === q.answer ? "Correct. " : "Not quite. "}${q.note}` : ""}</div>
      {answered && (
        <button className="btn" type="button" onClick={() => { setI(i + 1); setPick(null); }}>
          {i === questions.length - 1 ? "See result ▶▶" : "Next ▶▶"}
        </button>
      )}
    </div>
  );
}
