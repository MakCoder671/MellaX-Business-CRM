"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/form";

// ----------------------------------------------------------------------------
// "Reach over time" — how many client inboxes each sent e-blast landed
// in, in send order, plus the running total underneath it. Reads left
// to right as "campaign after campaign, this is the audience you've
// built" rather than just a bare list of numbers. Drafts are excluded
// (recipient_count is meaningless until something's actually sent).
//
// Colors come from the account's --accent-* theme variables (same ones
// Button/PageHeader use) via inline style, not Tailwind classes —
// Tailwind's arbitrary-value utilities can't safely resolve a value that
// might be a solid hex OR a gradient, and Recharts' fill/stroke props
// happily accept a plain CSS color string either way.
// ----------------------------------------------------------------------------

type EBlastPoint = {
  id: number;
  subject: string;
  sent_at: string;
  recipient_count: number;
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: EBlastPoint & { cumulative: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="max-w-[180px] truncate text-xs font-semibold text-gray-900">{point.subject}</p>
      <p className="text-xs text-gray-500">
        {new Date(point.sent_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">{point.recipient_count} recipients</p>
      <p className="text-xs text-gray-400">{point.cumulative} total reach</p>
    </div>
  );
}

export function ReachChart({ eblasts }: { eblasts: EBlastPoint[] }) {
  const sorted = [...eblasts].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
  // A running total built via reduce (a fresh accumulator each step)
  // rather than mutating an outer `running` variable inside .map() —
  // React's render function has to stay pure, and mutating a variable
  // declared in the render body while computing derived data violates
  // that even though nothing here is actually stateful across renders.
  const data = sorted.reduce<(EBlastPoint & { cumulative: number })[]>((acc, e) => {
    const previousTotal = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({ ...e, cumulative: previousTotal + e.recipient_count });
    return acc;
  }, []);
  const totalReach = data.length > 0 ? data[data.length - 1].cumulative : 0;

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Reach over time</h2>
        <div className="mt-8 flex h-40 items-center justify-center text-sm text-gray-400">
          Send your first e-blast to start seeing your reach grow here.
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Reach over time</h2>
        <p className="text-xs text-gray-400">{totalReach} total inboxes reached</p>
      </div>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-500, #10b981)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-500, #10b981)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="sent_at"
              tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="var(--accent-600, #059669)"
              strokeWidth={2.5}
              fill="url(#reachFill)"
              dot={{ r: 3, fill: "var(--accent-600, #059669)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
