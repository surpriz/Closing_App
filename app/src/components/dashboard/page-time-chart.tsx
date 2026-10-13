"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type XAxisTickContentProps,
} from "recharts";

import { HeatScale } from "@/components/brand/thermal-plate";
import { segmentLabel } from "@/lib/closing/documents/video-segments";

export type PageTimeDatum = {
  pageNumber: number;
  totalSeconds: number;
  avgSeconds: number;
  isPricing: boolean;
  /** What the page is about, from the AI reading. */
  summary?: string | null;
};

const MONO = "var(--font-mono)";
const TICK = { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: MONO };

/**
 * Reading time per page. Each bar uncovers the ironbow scale up to its height, so the
 * most-read page is the hottest one; the pricing page is marked in ink under its label.
 * `video`: the bars are tenths of a video pitch, not pages.
 */
export function PageTimeChart({ data, video = false }: { data: PageTimeDatum[]; video?: boolean }) {
  const uid = `ironbow${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const name = (page: number) => (video ? segmentLabel(page) : `Page ${page}`);
  const pricing = new Set(data.filter((d) => d.isPricing).map((d) => d.pageNumber));
  const tickLabel = (page: number) => (video ? `${(page - 1) * 10} %` : `p.${page}`);

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="pageNumber"
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: "var(--foreground)" }}
              height={34}
              tick={({ x, y, payload }: XAxisTickContentProps) => {
                const page = Number(payload.value);
                const isPricing = pricing.has(page);
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      dy={12}
                      textAnchor="middle"
                      fontFamily={MONO}
                      fontSize={11}
                      fontWeight={isPricing ? 600 : 400}
                      fill={isPricing ? "var(--foreground)" : "var(--muted-foreground)"}
                    >
                      {tickLabel(page)}
                    </text>
                    {isPricing && <rect x={-7} y={18} width={14} height={2} fill="var(--foreground)" />}
                  </g>
                );
              }}
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
                borderRadius: 4,
                border: "1px solid var(--foreground)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                boxShadow: "var(--elevation-md)",
                fontSize: 13,
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: "var(--popover-foreground)", fontFamily: MONO, fontSize: 12 }}
              labelFormatter={(label, payload) => {
                const summary = (payload?.[0]?.payload as PageTimeDatum | undefined)?.summary;
                return summary ? `${name(Number(label))} : ${summary}` : name(Number(label));
              }}
              formatter={(value, _name, item) => {
                const datum = item.payload as PageTimeDatum;
                const per = video ? "par visionnage" : "par lecture";
                return [
                  `${value} s au total · ${datum.avgSeconds} s ${per}`,
                  datum.isPricing ? "Tarifs" : video ? "Visionnage" : "Lecture",
                ];
              }}
            />
            <Bar
              dataKey="totalSeconds"
              maxBarSize={36}
              shape={(props: BarShapeProps) => <IronbowBar {...props} gradientId={`${uid}-${props.index}`} />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex flex-wrap items-center gap-x-6 gap-y-1 text-small text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          peu lu
          <HeatScale className="h-1.5 w-16" />
          très lu
        </span>
        {pricing.size > 0 && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3.5 bg-foreground" />
            {video ? "passage sur les tarifs" : "page de tarifs"}
          </span>
        )}
      </p>
    </div>
  );
}

/** A square bar painted with the scale over the whole plot height: only the tallest reaches the hot end. */
function IronbowBar({ x, y, width, height, background, gradientId }: BarShapeProps & { gradientId: string }) {
  if (!height || height <= 0) return null;
  const top = background?.y ?? y;
  const bottom = (background?.y ?? y) + (background?.height ?? height);
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={bottom} x2={0} y2={top}>
          <stop offset="0%" stopColor="var(--iron-0)" />
          <stop offset="35%" stopColor="var(--iron-1)" />
          <stop offset="70%" stopColor="var(--iron-2)" />
          {/* White-hot would vanish on paper: the bars stop at sodium yellow */}
          <stop offset="100%" stopColor="var(--iron-3)" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${gradientId})`} />
    </g>
  );
}
