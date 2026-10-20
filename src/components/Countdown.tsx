"use client";

import { useEffect, useState } from "react";

export function Countdown({ date }: { date: string }) {
  const [days, setDays] = useState<string>("---");
  useEffect(() => {
    const [y, m, d] = date.split("-").map(Number);
    const target = new Date(y, (m || 1) - 1, d || 1);
    const n = Math.ceil((target.getTime() - Date.now()) / 86400000);
    setDays(Number.isFinite(n) ? String(Math.max(0, n)) : "---");
  }, [date]);
  return <div className="big">{days}</div>;
}
