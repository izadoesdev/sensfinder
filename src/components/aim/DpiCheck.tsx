"use client";

import { useCallback, useRef, useState } from "react";
import { usePointerLock } from "@/hooks/usePointerLock";
import { useSettings } from "@/store/settings";
import { Badge, Button, Card, CardHeader, NumberInput } from "@/components/ui";

/**
 * Empirical input calibration.
 *
 * Two things can silently corrupt every number this app produces: a DPI the user
 * mis-remembers, and a browser that scales `movementX` by device pixel ratio, page
 * zoom or OS pointer speed. Both have the same signature — a constant multiplier
 * between the counts we think we received and the counts the mouse actually sent.
 *
 * So rather than trust either, measure the multiplier: drag a known physical distance
 * and solve for it. Whatever the cause, the correction absorbs it.
 */
export function DpiCheck() {
  const dpi = useSettings((s) => s.dpi);
  const inputScale = useSettings((s) => s.inputScale);
  const verified = useSettings((s) => s.inputScaleVerified);
  const setInputScale = useSettings((s) => s.setInputScale);

  const ref = useRef<HTMLDivElement>(null);
  const accumulated = useRef(0);
  const [distanceCm, setDistanceCm] = useState(20);
  const [result, setResult] = useState<{ measured: number; scale: number } | null>(null);

  const onMove = useCallback((dx: number) => {
    accumulated.current += dx;
  }, []);

  const finish = useCallback(() => {
    const moved = Math.abs(accumulated.current);
    if (moved < 50) return; // a stray click, not a drag
    const expectedCounts = (dpi * distanceCm) / 2.54;
    setResult({
      measured: (moved * 2.54) / distanceCm,
      scale: expectedCounts / moved,
    });
  }, [dpi, distanceCm]);

  const { locked, request, exit } = usePointerLock(ref, {
    onMove,
    onLockChange: (isLocked) => {
      if (isLocked) accumulated.current = 0;
      else finish();
    },
  });

  const drift = result ? (result.scale - 1) * 100 : 0;
  const significant = Math.abs(drift) > 5;

  return (
    <Card>
      <CardHeader
        title="Check your DPI"
        hint="Wrong DPI means wrong results. This measures what your mouse actually reports. Takes 10 seconds."
        action={
          <Badge tone={verified ? "good" : "neutral"}>
            {verified ? "Checked" : "Not checked"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-[170px_1fr] sm:items-end">
        <NumberInput
          label="Drag distance"
          value={distanceCm}
          onChange={setDistanceCm}
          min={5}
          max={100}
          step={1}
          largeStep={5}
          suffix="cm"
        />

        <div
          ref={ref}
          onClick={() => (locked ? exit() : request())}
          className={`flex h-[38px] cursor-pointer select-none items-center justify-center rounded-lg border px-4 text-[13px] transition-colors ${
            locked
              ? "border-accent-8 bg-accent-3 text-accent-11"
              : "border-border bg-raised text-text-2 hover:border-border-strong hover:text-text"
          }`}
        >
          {locked ? "Now drag right, then click again" : "Click here to start"}
        </div>
      </div>

      <ol className="mt-5 grid gap-2 text-[13px] text-text-3 sm:grid-cols-3">
        <Step n={1}>Mark {distanceCm} cm on your pad with a ruler.</Step>
        <Step n={2}>Mouse on the left mark, click the box.</Step>
        <Step n={3}>Slide to the right mark, click again.</Step>
      </ol>

      {result && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            significant ? "border-warn/40 bg-warn/8" : "border-good/40 bg-good/8"
          }`}
        >
          <div className="font-mono text-[13px] tabular text-text">
            Measured {result.measured.toFixed(0)} DPI · you entered {dpi}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            {significant
              ? `That's ${Math.abs(drift).toFixed(0)}% off. Applying the fix makes training match your real sensitivity.`
              : "Close enough. Nothing needs fixing."}
          </p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => setInputScale(result.scale, true)}
          >
            {significant ? "Apply fix" : "Save"}
          </Button>
        </div>
      )}

      {verified && !result && Math.abs(inputScale - 1) > 0.001 && (
        <p className="mt-4 text-xs text-text-3">
          Correcting your input by{" "}
          <span className="tabular">{((inputScale - 1) * 100).toFixed(1)}%</span>.
        </p>
      )}
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-[18px] w-[18px] shrink-0 select-none items-center justify-center rounded-sm border border-gray-5 bg-raised font-mono text-[10px] text-text-3">
        {n}
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}
