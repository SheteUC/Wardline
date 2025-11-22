"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye } from "lucide-react";
import { formatDuration, formatPhoneNumber } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

export type Call = {
    id: string;
    callerName: string;
    callerPhone: string;
    datetime: Date;
    duration: number;
    status: "completed" | "abandoned" | "transferred";
    isEmergency: boolean;
    intent: string;
    sentiment?: "positive" | "neutral" | "negative";
};

export const columns: ColumnDef<Call>[] = [
    {
        accessorKey: "callerName",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Caller
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return (
                <div>
                    <div className="font-medium">{row.getValue("callerName")}</div>
                    <div className="text-sm text-muted-foreground">
                        {formatPhoneNumber(row.original.callerPhone)}
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "datetime",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Date & Time
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const date = row.getValue("datetime") as Date;
            return (
                <div>
                    <div>{format(date, "MMM d, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">
                        {format(date, "h:mm a")}
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "duration",
        header: "Duration",
        cell: ({ row }) => {
            return formatDuration(row.getValue("duration"));
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return (
                <Badge
                    variant={
                        status === "completed"
                            ? "success"
                            : status === "abandoned"
                                ? "destructive"
                                : "secondary"
                    }
                >
                    {status}
                </Badge>
            );
        },
    },
    {
        accessorKey: "isEmergency",
        header: "Emergency",
        cell: ({ row }) => {
            return row.getValue("isEmergency") ? (
                <Badge variant="destructive">Yes</Badge>
            ) : (
                <span className="text-muted-foreground">No</span>
            );
        },
    },
    {
        accessorKey: "intent",
        header: "Intent",
        cell: ({ row }) => {
            return <Badge variant="outline">{row.getValue("intent")}</Badge>;
        },
    },
    {
        accessorKey: "sentiment",
        header: "Sentiment",
        cell: ({ row }) => {
            const sentiment = row.getValue("sentiment") as string | undefined;
            if (!sentiment) return <span className="text-muted-foreground">-</span>;
            return (
                <Badge
                    variant={
                        sentiment === "positive"
                            ? "success"
                            : sentiment === "negative"
                                ? "warning"
                                : "secondary"
                    }
                >
                    {sentiment}
                </Badge>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const call = row.original;
            return (
                <Link href={`/dashboard/calls/${call.id}`}>
                    <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                    </Button>
                </Link>
            );
        },
    },
];
