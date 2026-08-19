"use client";

import dynamic from "next/dynamic";

/**
 * A design harness for the session report.
 *
 * Iterating on the report otherwise means shooting a full 72-shot block for every
 * layout tweak. It renders from the same simulator the test suite uses, so what you see
 * is produced by the real engine and the real analysis — only the hand moving the mouse
 * is scripted.
 *
 * Client-only: simulating a whole block is pointless work on the server, and the result
 * feeds charts whose markup would have to match byte for byte on both sides.
 */
const Preview = dynamic(() => import("./Preview").then((m) => m.Preview), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-page" />,
});

export default function PreviewPage() {
  return <Preview />;
}
