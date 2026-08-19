"use client";

export function ConditionTable({
  data,
}: {
  data: { A: number; W: number; n: number; IDe: number; meanMT: number; throughput: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Throughput per distance and target-width condition
        </caption>
        <thead className="text-text-3">
          <tr>
            {["Distance", "Width", "n", "IDe", "Mean MT", "Throughput"].map((h) => (
              <th key={h} className="pb-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular">
          {[...data]
            .sort((a, b) => a.IDe - b.IDe)
            .map((c) => (
              <tr key={`${c.A}-${c.W}`} className="border-t border-gray-4">
                <td className="py-2 pr-4">{c.A.toFixed(1)}°</td>
                <td className="py-2 pr-4">{c.W.toFixed(2)}°</td>
                <td className="py-2 pr-4">{c.n}</td>
                <td className="py-2 pr-4">{c.IDe.toFixed(2)}</td>
                <td className="py-2 pr-4">{(c.meanMT * 1000).toFixed(0)} ms</td>
                <td className="py-2 pr-4 text-text">{c.throughput.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
