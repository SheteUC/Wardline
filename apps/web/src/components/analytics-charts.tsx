"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

// Mock analytics data
const callVolumeData = [
    { date: "Nov 15", calls: 45, emergency: 3 },
    { date: "Nov 16", calls: 52, emergency: 2 },
    { date: "Nov 17", calls: 38, emergency: 1 },
    { date: "Nov 18", calls: 65, emergency: 5 },
    { date: "Nov 19", calls: 72, emergency: 4 },
    { date: "Nov 20", calls: 58, emergency: 2 },
    { date: "Nov 21", calls: 81, emergency: 6 },
    { date: "Nov 22", calls: 127, emergency: 3 },
];

const intentDistribution = [
    { name: "Appointment Booking", value: 45, color: "#3b82f6" },
    { name: "Billing Inquiry", value: 28, color: "#10b981" },
    { name: "Prescription Refill", value: 18, color: "#f59e0b" },
    { name: "Emergency", value: 6, color: "#ef4444" },
    { name: "General Info", value: 3, color: "#8b5cf6" },
];

const performanceData = [
    { hour: "12am", avgDuration: 142, callCount: 12 },
    { hour: "3am", avgDuration: 158, callCount: 8 },
    { hour: "6am", avgDuration: 165, callCount: 15 },
    { hour: "9am", avgDuration: 195, callCount: 32 },
    { hour: "12pm", avgDuration: 205, callCount: 45 },
    { hour: "3pm", avgDuration: 218, callCount: 38 },
    { hour: "6pm", avgDuration: 185, callCount: 28 },
    { hour: "9pm", avgDuration: 156, callCount: 18 },
];

const sentimentTrends = [
    { date: "Nov 15", positive: 75, neutral: 20, negative: 5 },
    { date: "Nov 16", positive: 78, neutral: 18, negative: 4 },
    { date: "Nov 17", positive: 72, neutral: 22, negative: 6 },
    { date: "Nov 18", positive: 80, neutral: 15, negative: 5 },
    { date: "Nov 19", positive: 82, neutral: 14, negative: 4 },
    { date: "Nov 20", positive: 76, neutral: 19, negative: 5 },
    { date: "Nov 21", positive: 85, neutral: 12, negative: 3 },
    { date: "Nov 22", positive: 88, neutral: 10, negative: 2 },
];

export function AnalyticsCharts() {
    return (
        <Tabs defaultValue="volume" className="space-y-4">
            <TabsList>
                <TabsTrigger value="volume">Call Volume</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
                <TabsTrigger value="intents">Intents</TabsTrigger>
            </TabsList>

            {/* Call Volume Chart */}
            <TabsContent value="volume" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Call Volume Trend</CardTitle>
                        <CardDescription>
                            Daily call volumes over the past week
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={callVolumeData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="calls"
                                    stackId="1"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.6}
                                    name="Total Calls"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="emergency"
                                    stackId="2"
                                    stroke="#ef4444"
                                    fill="#ef4444"
                                    fillOpacity={0.6}
                                    name="Emergency"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Performance Chart */}
            <TabsContent value="performance" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Performance by Hour</CardTitle>
                        <CardDescription>
                            Average call duration and volume throughout the day
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={performanceData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    yAxisId="left"
                                    dataKey="avgDuration"
                                    fill="#3b82f6"
                                    name="Avg Duration (s)"
                                />
                                <Bar
                                    yAxisId="right"
                                    dataKey="callCount"
                                    fill="#10b981"
                                    name="Call Count"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Sentiment Chart */}
            <TabsContent value="sentiment" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Sentiment Analysis</CardTitle>
                        <CardDescription>
                            Caller sentiment trends over time
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={sentimentTrends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="positive"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    name="Positive"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="neutral"
                                    stroke="#64748b"
                                    strokeWidth={2}
                                    name="Neutral"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="negative"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    name="Negative"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Intent Distribution Chart */}
            <TabsContent value="intents" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Call Intent Distribution</CardTitle>
                        <CardDescription>
                            Breakdown of call purposes and intents
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                                <Pie
                                    data={intentDistribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) =>
                                        `${name}: ${(percent * 100).toFixed(0)}%`
                                    }
                                    outerRadius={120}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {intentDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
