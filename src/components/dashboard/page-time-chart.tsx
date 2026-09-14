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
};

const PRICING_COLOR = "#f59e0b";
const PAGE_COLOR = "var(--primary)";

export function PageTimeChart({ data }: { data: PageTimeDatum[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="pageNumber"
            tickFormatter={(page: number) => `p.${page}`}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            tickFormatter={(seconds: number) => `${seconds}s`}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            labelFormatter={(label) => `Page ${label}`}
            formatter={(value, _name, item) => {
              const datum = item.payload as PageTimeDatum;
              return [`${value} s au total · ${datum.avgSeconds} s par lecture`, datum.isPricing ? "Tarifs" : "Lecture"];
            }}
          />
          <Bar dataKey="totalSeconds" radius={[4, 4, 0, 0]}>
            {data.map((datum) => (
              <Cell key={datum.pageNumber} fill={datum.isPricing ? PRICING_COLOR : PAGE_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
