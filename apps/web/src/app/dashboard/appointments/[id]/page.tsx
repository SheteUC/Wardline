import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, User, Calendar, Clock, FileText, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AppointmentStatus = "SCHEDULED" | "RESCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

// Mock appointment details  
const mockAppointmentDetails = {
    "1": {
        id: "1",
        patientName: "John Smith",
        patientPhone: "555-123-4567",
        patientEmail: "john@example.com",
        providerName: "Dr. Johnson",
        serviceType: "Consultation",
        scheduledAt: addDays(new Date(), 1),
        duration: 30,
        status: "SCHEDULED" as AppointmentStatus,
        notes: "Patient requested afternoon appointment. Follow-up for blood work results.",
        callId: "call_123",
        createdAt: new Date(2025, 10, 20),
        provider: "timetap",
        externalId: "tt_abc123",
    },
};

const statusConfig: Record<AppointmentStatus, { label: string; variant: any }> = {
    SCHEDULED: { label: "Scheduled", variant: "default" },
    RESCHEDULED: { label: "Rescheduled", variant: "secondary" },
    COMPLETED: { label: "Completed", variant: "success" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
    NO_SHOW: { label: "No Show", variant: "warning" },
};

export default async function AppointmentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await currentUser();
    const { id } = await params;

    if (!user) {
        redirect("/sign-in");
    }

    const appointment = mockAppointmentDetails[id as keyof typeof mockAppointmentDetails];

    if (!appointment) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/dashboard/appointments" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1">
                        <ArrowLeft className="h-4 w-4" /> Back to Appointments
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Appointment Details</h1>
                    <p className="text-muted-foreground">{format(appointment.scheduledAt, "MMMM d, yyyy 'at' h:mm a")}</p>
                </div>
                {appointment.status === "SCHEDULED" && (
                    <div className="flex gap-2">
                        <Button variant="outline">Reschedule</Button>
                        <Button variant="outline">Cancel</Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Patient Information</CardTitle>
                            <Badge variant={statusConfig[appointment.status].variant}>{statusConfig[appointment.status].label}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Patient Name</p>
                                <p className="text-lg font-semibold">{appointment.patientName}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-start gap-3">
                            <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                                <p className="font-medium">{appointment.patientPhone}</p>
                            </div>
                        </div>
                        {appointment.patientEmail && (
                            <>
                                <Separator />
                                <div className="flex items-start gap-3">
                                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                                        <p className="font-medium">{appointment.patientEmail}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Appointment Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Provider</p>
                                <p className="font-semibold">{appointment.providerName}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Service Type</p>
                                <p className="font-medium">{appointment.serviceType}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                                <p className="font-medium">{format(appointment.scheduledAt, "EEEE, MMMM d, yyyy")}</p>
                                <p className="text-sm text-muted-foreground">{format(appointment.scheduledAt, "h:mm a")}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                                <p className="font-medium">{appointment.duration} minutes</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {appointment.notes && (
                <Card>
                    <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                    <CardContent><p className="text-sm">{appointment.notes}</p></CardContent>
                </Card>
            )}

            {appointment.callId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Booked During Call</CardTitle>
                        <CardDescription>This appointment was scheduled during an AI-assisted call</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <p className="font-medium">Call ID: {appointment.callId}</p>
                                <p className="text-sm text-muted-foreground">Booked on {format(appointment.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
                            </div>
                            <Link href={`/dashboard/calls/${appointment.callId.replace("call_", "")}`}>
                                <Button variant="outline" size="sm">View Call</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>System Information</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                            <p className="font-medium text-muted-foreground mb-1">Provider System</p>
                            <p className="capitalize">{appointment.provider}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground mb-1">External ID</p>
                            <p className="font-mono text-xs">{appointment.externalId}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground mb-1">Created</p>
                            <p>{format(appointment.createdAt, "MMM d, yyyy")}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
