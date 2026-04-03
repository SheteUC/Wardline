"use client";

import type { CallAnalytics } from "@/lib/api-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@wardline/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ROUTE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const OUTCOME_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1"];
const LABELS: Record<string, string> = {
  SCHEDULING: "Scheduling",
  BILLING: "Billing",
  INSURANCE: "Insurance",
  FAQ: "FAQ",
  PRESCRIPTION_REFILL: "Refill",
  HUMAN_TRANSFER: "Human transfer",
  VOICEMAIL: "Voicemail",
  EMERGENCY: "Emergency",
};

type AnalyticsChartsProps = {
  analytics: CallAnalytics;
  aiResolved: number;
  escalatedCalls: number;
};

export function AnalyticsCharts({
  analytics,
  aiResolved,
  escalatedCalls,
}: AnalyticsChartsProps) {
  const routeBreakdown = Object.entries(analytics.callsByTag)
    .filter(([, value]) => value > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([tag, value], index) => ({
      route: LABELS[tag] ?? tag,
      value,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    }));

  const outcomes = [
    { name: "AI resolved", value: aiResolved, color: OUTCOME_COLORS[0] },
    { name: "Escalated", value: escalatedCalls, color: OUTCOME_COLORS[1] },
    { name: "Abandoned", value: analytics.abandonedCalls, color: OUTCOME_COLORS[2] },
    { name: "Voicemail", value: analytics.voicemailCount, color: OUTCOME_COLORS[3] },
  ].filter((entry) => entry.value > 0);

  const operationsSnapshot = [
    { name: "Total calls", value: analytics.totalCalls },
    { name: "Completed", value: analytics.completedCalls },
    { name: "Emergency", value: analytics.emergencyCalls },
    { name: "Avg duration (sec)", value: analytics.avgDurationSeconds },
  ];

  return (
    <Tabs defaultValue="routing" className="space-y-4">
      <TabsList>
        <TabsTrigger value="routing">Routing</TabsTrigger>
        <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
        <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
      </TabsList>

      <TabsContent value="routing" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Route Distribution</CardTitle>
            <CardDescription>Which workflows handled today&apos;s calls.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={routeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="route" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {routeBreakdown.map((entry) => (
                    <Cell key={entry.route} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="outcomes" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Outcome Mix</CardTitle>
            <CardDescription>How today&apos;s calls resolved across AI, staff, and voicemail.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={outcomes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  dataKey="value"
                >
                  {outcomes.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="snapshot" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Operations Snapshot</CardTitle>
            <CardDescription>High-signal metrics the team can act on immediately.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {operationsSnapshot.map((metric) => (
                <div key={metric.name} className="rounded-2xl bg-[var(--background)] p-4 neo-inset">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {metric.name}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
