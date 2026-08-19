"use client";

import { Meter } from "@base-ui-components/react/meter";
import { Badge, Eyebrow } from "@/components/ui";

/**
 * The physical constraint, made visible.
 *
 * A sensitivity that needs more pad than you own is not a taste question — every 180
 * costs you a reposition, and no amount of training fixes it. Showing the required
 * travel against the pad turns an abstract cm/360 into something you can check against
 * the desk in front of you.
 *
 * Built on Base UI's Meter so the value is announced properly rather than being a
 * decorative pair of divs.
 */
export function TravelMeter({
  cm360,
  padWidthCm,
}: {
  cm360: number;
  padWidthCm: number;
}) {
  const cm180 = cm360 / 2;
  const cm90 = cm360 / 4;
  const scaleMax = Math.max(padWidthCm, cm180) * 1.1;

  const overflows = cm180 > padWidthCm;
  const tight = !overflows && cm180 > padWidthCm * 0.8;
  const pct = (v: number) => `${(v / scaleMax) * 100}%`;

  return (
    <Meter.Root
      value={cm180}
      max={scaleMax}
      getAriaValueText={() =>
        `${cm180.toFixed(1)} centimetres needed for a 180 degree turn on a ${padWidthCm} centimetre pad`
      }
      className="mt-6 border-t border-accent-5 pt-5"
    >
      <div className="flex items-center justify-between">
        <Meter.Label render={<Eyebrow>{`On a ${padWidthCm} cm pad`}</Eyebrow>} />
        <Badge tone={overflows ? "crit" : tight ? "warn" : "good"}>
          {overflows ? "Won't fit" : tight ? "Tight" : "Fits"}
        </Badge>
      </div>

      <div className="relative mt-4 h-8 select-none">
        {/* The pad itself */}
        <div
          className="absolute top-3 h-2.5 rounded-sm border border-gray-6 bg-gray-3"
          style={{ width: pct(padWidthCm) }}
        />

        <Meter.Track className="absolute top-3 h-2.5 w-full bg-transparent">
          {/* 0–90°: comfortably inside a single swipe for anyone */}
          <div
            className="absolute top-0 h-2.5 rounded-l-sm bg-accent-9"
            style={{ width: pct(cm90) }}
          />
          {/* 90–180°: the part that decides whether you can turn around */}
          <Meter.Indicator
            render={
              <div
                style={{ left: pct(cm90), width: pct(cm180 - cm90) }}
                className={`absolute top-0 h-2.5 rounded-r-sm ${
                  overflows ? "bg-crit" : "bg-accent-6"
                }`}
              />
            }
          />
        </Meter.Track>

        {/* Pad edge */}
        <div className="absolute top-1.5 h-5 w-px bg-gray-8" style={{ left: pct(padWidthCm) }} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs tabular text-text-3">
        <span>
          <span className="text-accent-9">90°</span> {cm90.toFixed(1)} cm
        </span>
        <Meter.Value className="text-text-3" render={<span />}>
          {() => (
            <>
              <span className={overflows ? "text-crit" : "text-text-2"}>180°</span>{" "}
              {cm180.toFixed(1)} cm
            </>
          )}
        </Meter.Value>
      </div>
    </Meter.Root>
  );
}
