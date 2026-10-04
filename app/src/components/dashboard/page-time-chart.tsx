"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PageTimeDatum = {
  pageNumber: number;
  totalSeconds: number;
  avgSeconds: number;
  isPricing: boolean;
  /** What the page is about, from the AI reading. */
  summary?: string | null;
};

const PRICING_COLOR = "var(--heat-warm)";
const PAGE_COLOR = "var(--foreground)";
const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

export function PageTimeChart({ data }: { data: PageTimeDatum[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="pageNumber"
            tickFormatter={(page: number) => `p.${page}`}
            tickLine={false}
            axisLine={false}
            tick={TICK}
          />
          <YAxis
            tickFormatter={(seconds: number) => `${seconds}s`}
            tickLine={false}
            axisLine={false}
            tick={TICK}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              maxWidth: 280,
              whiteSpace: "normal",
              borderRadius: 10,
              border: "1px solid var(--border)",
              boxShadow: "0 8px 24px -12px rgb(15 30 51 / 0.25)",
              fontSize: 13,
            }}
            labelFormatter={(label, payload) => {
              const summary = (payload?.[0]?.payload as PageTimeDatum | undefined)?.summary;
              return summary ? `Page ${label} : ${summary}` : `Page ${label}`;
            }}
            formatter={(value, _name, item) => {
              const datum = item.payload as PageTimeDatum;
              return [`${value} s au total · ${datum.avgSeconds} s par lecture`, datum.isPricing ? "Tarifs" : "Lecture"];
            }}
          />
          <Bar dataKey="totalSeconds" radius={[5, 5, 1, 1]} maxBarSize={36}>
            {data.map((datum) => (
              <Cell key={datum.pageNumber} fill={datum.isPricing ? PRICING_COLOR : PAGE_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
