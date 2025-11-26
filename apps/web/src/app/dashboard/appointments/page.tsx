import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, Clock, User, Plus } from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Mock appointments data
const mockAppointments = [
    {
        id: "1",
        patientName: "John Smith",
        patientPhone: "555-123-4567",
        patientEmail: "john@example.com",
        providerName: "Dr. Johnson",
        serviceType: "Consultation",
        scheduledAt: addDays(new Date(), 1),
        duration: 30,
        status: "SCHEDULED" as const,
        callId: "call_123",
    },
    {
        id: "2",
        patientName: "Sarah Williams",
        patientPhone: "555-987-6543",
        patientEmail: "sarah@example.com",
        providerName: "Dr. Smith",
        serviceType: "Follow-up",
        scheduledAt: addDays(new Date(), 2),
        duration: 15,
        status: "SCHEDULED" as const,
        callId: "call_456",
    },
    {
        id: "3",
        patientName: "Michael Brown",
        patientPhone: "555-555-1234",
        patientEmail: "michael@example.com",
        providerName: "Dr. Johnson",
        serviceType: "Annual Checkup",
        scheduledAt: addDays(new Date(), 5),
        duration: 45,
        status: "SCHEDULED" as const,
    },
    {
        id: "4",
        patientName: "Emily Davis",
        patientPhone: "555-444-5555",
        providerName: "Dr. Lee",
        serviceType: "Lab Results Review",
        scheduledAt: addDays(new Date(), -1),
        duration: 20,
        status: "COMPLETED" as const,
    },
];

const statusConfig = {
    SCHEDULED: { label: "Scheduled", variant: "default" as const },
    RESCHEDULED: { label: "Rescheduled", variant: "secondary" as const },
    COMPLETED: { label: "Completed", variant: "success" as const },
    CANCELLED: { label: "Cancelled", variant: "destructive" as const },
    NO_SHOW: { label: "No Show", variant: "warning" as const },
};

export default async function AppointmentsPage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const today = new Date();
    const upcomingAppointments = mockAppointments.filter(
        (apt) => apt.scheduledAt >= today && apt.status === "SCHEDULED"
    );
    const completedCount = mockAppointments.filter((apt) => apt.status === "COMPLETED").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
                    <p className="text-muted-foreground">
                        Manage patient appointments and scheduling
                    </p>
                </div>
                <Link href="/dashboard/appointments/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Book Appointment
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Today</CardDescription>
                        <CardTitle className="text-2xl">
                            {mockAppointments.filter(
                                (apt) =>
                                    format(apt.scheduledAt, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
                            ).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Upcoming</CardDescription>
                        <CardTitle className="text-2xl">{upcomingAppointments.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Month</CardDescription>
                        <CardTitle className="text-2xl">
                            {mockAppointments.filter(
                                (apt) =>
                                    apt.scheduledAt >= startOfMonth(today) &&
                                    apt.scheduledAt <= endOfMonth(today)
                            ).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Completed</CardDescription>
                        <CardTitle className="text-2xl text-success-600">{completedCount}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Appointments List */}
            <Card>
                <CardHeader>
                    <CardTitle>Upcoming Appointments</CardTitle>
                    <CardDescription>
                        Appointments scheduled for the next 7 days
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {upcomingAppointments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No upcoming appointments</p>
                            </div>
                        ) : (
                            upcomingAppointments.map((appointment) => (
                                <Link
                                    key={appointment.id}
                                    href={`/dashboard/appointments/${appointment.id}`}
                                    className="block"
                                >
                                    <div className="flex items-center justify-between rounded-lg border p-4 hover:border-primary-600 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                                                <User className="h-6 w-6 text-primary-600" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-medium">{appointment.patientName}</p>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {appointment.patientPhone}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {appointment.providerName}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-medium">
                                                    {format(appointment.scheduledAt, "MMM d, yyyy")}
                                                </p>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {format(appointment.scheduledAt, "h:mm a")} •{" "}
                                                    {appointment.duration}min
                                                </div>
                                            </div>
                                            <Badge variant={statusConfig[appointment.status].variant}>
                                                {statusConfig[appointment.status].label}
                                            </Badge>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* All Appointments */}
            <Card>
                <CardHeader>
                    <CardTitle>All Appointments</CardTitle>
                    <CardDescription>
                        Complete appointment history
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {mockAppointments.map((appointment) => (
                            <Link
                                key={appointment.id}
                                href={`/dashboard/appointments/${appointment.id}`}
                                className="block"
                            >
                                <div className="flex items-center justify-between rounded-lg border p-3 hover:border-primary-600 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <p className="font-medium text-sm">{appointment.patientName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {appointment.serviceType}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="text-sm">
                                            {format(appointment.scheduledAt, "MMM d, h:mm a")}
                                        </p>
                                        <Badge variant={statusConfig[appointment.status].variant} className="text-xs">
                                            {statusConfig[appointment.status].label}
                                        </Badge>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
