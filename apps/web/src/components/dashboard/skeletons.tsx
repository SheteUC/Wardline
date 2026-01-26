"use client";

import React from 'react';

/**
 * Skeleton loading components for better perceived performance.
 * These match the exact layout of actual components to prevent layout shift.
 */

// Base skeleton with shimmer animation
function Skeleton({ className = '' }: { className?: string }) {
    return (
        <div
            className={`animate-pulse bg-gradient-to-r from-muted via-muted/80 to-muted bg-[length:200%_100%] rounded ${className}`}
            style={{
                animation: 'shimmer 1.5s ease-in-out infinite',
            }}
        />
    );
}

// Add shimmer keyframes via inline style (for cases where globals.css isn't used)
const shimmerStyles = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

// Stat card skeleton - matches StatCard layout
export function StatCardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
        </div>
    );
}

// Dashboard stats grid skeleton
export function StatsGridSkeleton() {
    return (
        <>
            <style>{shimmerStyles}</style>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>
        </>
    );
}

// Chart card skeleton
export function ChartSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-card border border-border rounded-xl p-6 shadow-sm ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-[250px] w-full" />
        </div>
    );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
    return (
        <tr className="border-b border-border/50">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-6 py-4">
                    <Skeleton className="h-5 w-full" />
                </td>
            ))}
        </tr>
    );
}

// Full table skeleton
export function TableSkeleton({ rows = 10, columns = 6 }: { rows?: number; columns?: number }) {
    return (
        <>
            <style>{shimmerStyles}</style>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                        <tr>
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="px-6 py-4">
                                    <Skeleton className="h-4 w-20" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {Array.from({ length: rows }).map((_, i) => (
                            <TableRowSkeleton key={i} columns={columns} />
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

// Calls page table skeleton with realistic column widths
export function CallsTableSkeleton() {
    return (
        <>
            <style>{shimmerStyles}</style>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                        <tr>
                            <th className="px-6 py-4 font-medium">Time / Date</th>
                            <th className="px-6 py-4 font-medium">Caller</th>
                            <th className="px-6 py-4 font-medium">Intent Detected</th>
                            <th className="px-6 py-4 font-medium">Sentiment</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium text-right">Duration</th>
                            <th className="px-6 py-4 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <tr key={i} className="hover:bg-muted/50 transition-colors">
                                <td className="px-6 py-4">
                                    <Skeleton className="h-4 w-24 mb-1" />
                                    <Skeleton className="h-3 w-16" />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-8 h-8 rounded-full" />
                                        <div>
                                            <Skeleton className="h-4 w-28 mb-1" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Skeleton className="h-6 w-24 rounded-full" />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="w-2 h-2 rounded-full" />
                                        <Skeleton className="h-4 w-12" />
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Skeleton className="h-4 w-12 ml-auto" />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Skeleton className="h-8 w-8 rounded ml-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

// Recent calls table skeleton (smaller, for dashboard)
export function RecentCallsSkeleton() {
    return (
        <>
            <style>{shimmerStyles}</style>
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                        <th className="px-4 py-3 font-medium">Caller</th>
                        <th className="px-4 py-3 font-medium">Intent</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Duration</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                            <td className="px-4 py-3">
                                <Skeleton className="h-4 w-24 mb-1" />
                                <Skeleton className="h-3 w-20" />
                            </td>
                            <td className="px-4 py-3">
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </td>
                            <td className="px-4 py-3">
                                <Skeleton className="h-4 w-16" />
                            </td>
                            <td className="px-4 py-3 text-right">
                                <Skeleton className="h-4 w-10 ml-auto" />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}

// Pie chart skeleton
export function PieChartSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <Skeleton className="w-40 h-40 rounded-full" />
            <div className="w-full mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center">
                            <Skeleton className="w-3 h-3 rounded-full mr-2" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-4 w-8" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// Live status card skeleton
export function LiveStatusSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-8" />
                </div>
            ))}
            <div className="mt-6 pt-4 border-t border-border">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-4 w-48" />
            </div>
        </div>
    );
}

// Full dashboard skeleton
export function DashboardSkeleton() {
    return (
        <>
            <style>{shimmerStyles}</style>
            <div className="space-y-6">
                {/* Top Metrics */}
                <StatsGridSkeleton />

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ChartSkeleton className="lg:col-span-2 min-h-[350px]" />
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[350px]">
                        <Skeleton className="h-5 w-32 mb-4" />
                        <PieChartSkeleton />
                    </div>
                </div>

                {/* Live Status & Recent Calls */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-1">
                        <Skeleton className="h-5 w-24 mb-4" />
                        <LiveStatusSkeleton />
                    </div>
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="h-8 w-16" />
                        </div>
                        <RecentCallsSkeleton />
                    </div>
                </div>
            </div>
        </>
    );
}

// Card skeleton for generic cards
export function CardSkeleton({ className = '', lines = 3 }: { className?: string; lines?: number }) {
    const lineWidths = ['100%', '85%', '70%', '55%', '40%'];
    return (
        <div className={`bg-card border border-border rounded-xl p-6 shadow-sm ${className}`}>
            <Skeleton className="h-5 w-1/3 mb-4" />
            <div className="space-y-3">
                {Array.from({ length: lines }).map((_, i) => (
                    <div key={i} style={{ width: lineWidths[i] || '40%' }}>
                        <Skeleton className="h-4 w-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}

