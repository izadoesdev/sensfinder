"use client";

import { useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/games";
import { SCENARIOS } from "@/lib/scenario";
import { useSettings } from "@/store/settings";
import { Hydrated } from "@/components/Hydrated";
import { METRICS, Progress } from "@/components/charts/Progress";
import { Button, ButtonLink, Card, CardHeader, Eyebrow } from "@/components/ui";

/**
 * Every round you have shot.
 *
 * A single session answers "what should my sensitivity be". This answers the question
 * that actually keeps someone training — "am I getting better" — from rounds that were
 * already being recorded and, until now, only used for the convergence chart inside one
 * report.
 */
export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Training log</Eyebrow>
          <h1 className="mt-2 text-[36px] font-semibold tracking-[-0.025em]">Your rounds</h1>
        </div>
        <ButtonLink href="/train" variant="primary">
          Shoot another
        </ButtonLink>
      </header>

      <Hydrated fallback={<div className="mt-10 h-96 rounded-xl border border-border bg-panel" />}>
        <History />
      </Hydrated>
    </main>
  );
}

function History() {
  const history = useSettings((s) => s.history);
  const clearHistory = useSettings((s) => s.clearHistory);
  const [metricId, setMetricId] = useState(METRICS[0].id);
  const [confirming, setConfirming] = useState(false);

  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];

  if (history.length === 0) {
    return (
      <Card className="mt-10" tone="quiet">
        <h2 className="text-lg font-medium">Nothing here yet</h2>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-text-2">
          Finish a round and it will show up here. Two or three is enough to see whether
          a change is helping.
        </p>
        <div className="mt-5">
          <ButtonLink href="/train" variant="primary">
            Start a round
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-10 space-y-3">
      {history.length >= 2 && (
        <Card>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetricId(m.id)}
                aria-pressed={m.id === metricId}
                className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  m.id === metricId
                    ? "border-accent-8 bg-accent-3 text-accent-11"
                    : "border-border bg-raised text-text-2 hover:border-border-strong hover:text-text"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Progress rounds={history} metric={metric} />
        </Card>
      )}

      <Card>
        <CardHeader title={`${history.length} rounds`} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-text-3">
              <tr>
                {["When", "Drill", "cm/360", "Bias", "Accuracy", "Score", "Shots"].map((h) => (
                  <th key={h} className="pb-2 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {[...history].reverse().map((r) => (
                <tr key={r.at} className="border-t border-gray-4">
                  <td className="py-2 pr-4 text-text-3">{when(r.at)}</td>
                  <td className="py-2 pr-4 text-text-3">
                    {SCENARIOS[r.scenarioId]?.name ?? r.scenarioId}
                  </td>
                  <td className="py-2 pr-4 text-text">
                    {r.cm360.toFixed(1)}
                    <span className="ml-1.5 text-text-3">
                      {GAMES[r.gameId].name.slice(0, 3).toLowerCase()} {r.sens}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {r.gain === null ? (
                      <span className="text-text-3">none</span>
                    ) : (
                      <span className={Math.abs(r.gain - 1) > 0.05 ? "text-warn" : "text-good"}>
                        {r.gain > 1 ? "+" : ""}
                        {((r.gain - 1) * 100).toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{(r.accuracy * 100).toFixed(0)}%</td>
                  <td className="py-2 pr-4">
                    {Number.isFinite(r.throughput) ? r.throughput.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-text-3">{r.shots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/"
          className="rounded-lg border border-border bg-raised px-4 py-2 text-sm text-text transition-colors hover:border-border-strong"
        >
          Settings
        </Link>
        {confirming ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                clearHistory();
                setConfirming(false);
              }}
            >
              Delete all {history.length} rounds
            </Button>
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={() => setConfirming(true)}>
            Clear history
          </Button>
        )}
      </div>
    </div>
  );
}

function when(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
