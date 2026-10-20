import Link from "next/link";

export default function NotFound() {
  return (
    <main className="authbox" style={{ textAlign: "center" }}>
      <h1>No signal</h1>
      <p>That page does not exist or has been taken off the shelf.</p>
      <p><Link className="btn" href="/">Back to the tapes</Link></p>
    </main>
  );
}
