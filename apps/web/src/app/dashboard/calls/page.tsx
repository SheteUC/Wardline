import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { columns, type Call } from "./columns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

// Mock data - in production, this would come from the API
const mockCalls: Call[] = [
    {
        id: "1",
        callerName: "John Smith",
        callerPhone: "5551234567",
        datetime: new Date(2025, 10, 22, 9, 30),
        duration: 245,
        status: "completed",
        isEmergency: false,
        intent: "Appointment Booking",
        sentiment: "positive",
    },
    {
        id: "2",
        callerName: "Sarah Johnson",
        callerPhone: "5559876543",
        datetime: new Date(2025, 10, 22, 10, 15),
        duration: 180,
        status: "completed",
        isEmergency: true,
        intent: "Emergency",
        sentiment: "negative",
    },
    {
        id: "3",
        callerName: "Michael Brown",
        callerPhone: "5555551234",
        datetime: new Date(2025, 10, 22, 11, 0),
        duration: 320,
        status: "transferred",
        isEmergency: false,
        intent: "Billing Inquiry",
        sentiment: "neutral",
    },
    {
        id: "4",
        callerName: "Emily Davis",
        callerPhone: "5554445555",
        datetime: new Date(2025, 10, 22, 13, 45),
        duration: 156,
        status: "completed",
        isEmergency: false,
        intent: "Prescription Refill",
        sentiment: "positive",
    },
    {
        id: "5",
        callerName: "Unknown Caller",
        callerPhone: "5556667777",
        datetime: new Date(2025, 10, 22, 14, 20),
        duration: 45,
        status: "abandoned",
        isEmergency: false,
        intent: "Unknown",
    },
];

export default async function CallsPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
                    <p className="text-muted-foreground">
                        View and manage all incoming calls
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Calls</CardDescription>
                        <CardTitle className="text-2xl">{mockCalls.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Completed</CardDescription>
                        <CardTitle className="text-2xl">
                            {mockCalls.filter((c) => c.status === "completed").length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Emergency</CardDescription>
                        <CardTitle className="text-2xl text-danger-600">
                            {mockCalls.filter((c) => c.isEmergency).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Duration</CardDescription>
                        <CardTitle className="text-2xl">
                            {Math.round(
                                mockCalls.reduce((acc, c) => acc + c.duration, 0) /
                                mockCalls.length
                            )}s
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Calls Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Calls</CardTitle>
                    <CardDescription>
                        A list of all calls received by your hospital
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={mockCalls}
                        searchKey="callerName"
                        searchPlaceholder="Search by caller name..."
                    />
                </CardContent>
            </Card>
        </div>
    );
}
