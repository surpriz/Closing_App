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

import { segmentLabel } from "@/lib/closing/documents/video-segments";

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

/** `video`: the bars are tenths of a video pitch, not pages. */
export function PageTimeChart({ data, video = false }: { data: PageTimeDatum[]; video?: boolean }) {
  const name = (page: number) => (video ? segmentLabel(page) : `Page ${page}`);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="pageNumber"
            tickFormatter={(page: number) => (video ? `${(page - 1) * 10} %` : `p.${page}`)}
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
              return summary ? `${name(Number(label))} : ${summary}` : name(Number(label));
            }}
            formatter={(value, _name, item) => {
              const datum = item.payload as PageTimeDatum;
              const per = video ? "par visionnage" : "par lecture";
              return [`${value} s au total · ${datum.avgSeconds} s ${per}`, datum.isPricing ? "Tarifs" : video ? "Visionnage" : "Lecture"];
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
