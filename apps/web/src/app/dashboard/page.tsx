import { currentUser } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Users, TrendingUp, Clock } from "lucide-react";
import { redirect } from "next/navigation";

// Force dynamic rendering for this page since it requires authentication
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back, {user.firstName}!
                </h1>
                <p className="text-muted-foreground">
                    Here's an overview of your hospital's call activity
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Calls Today
                        </CardTitle>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">127</div>
                        <p className="text-xs text-muted-foreground">
                            +12% from yesterday
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active Users
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
                        <p className="text-xs text-muted-foreground">
                            Staff members online
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Avg Response Time
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">2.4m</div>
                        <p className="text-xs text-muted-foreground">
                            -8% from last week
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Emergency Calls
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-danger-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">3</div>
                        <p className="text-xs text-muted-foreground">
                            Detected today
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>
                        Common tasks to get started
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border p-4 hover:border-primary-600 transition-colors cursor-pointer">
                            <h3 className="font-semibold">View Calls</h3>
                            <p className="text-sm text-muted-foreground">
                                Browse and manage call history
                            </p>
                        </div>
                        <div className="rounded-lg border p-4 hover:border-primary-600 transition-colors cursor-pointer">
                            <h3 className="font-semibold">Create Workflow</h3>
                            <p className="text-sm text-muted-foreground">
                                Build custom call handling flows
                            </p>
                        </div>
                        <div className="rounded-lg border p-4 hover:border-primary-600 transition-colors cursor-pointer">
                            <h3 className="font-semibold">View Analytics</h3>
                            <p className="text-sm text-muted-foreground">
                                Analyze call patterns and metrics
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
