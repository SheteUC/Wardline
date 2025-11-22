import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Clock, Download, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { formatDuration, formatPhoneNumber } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Mock data - in production, this would come from the API
const mockCallDetails: Record<string, any> = {
    "1": {
        id: "1",
        callerName: "John Smith",
        callerPhone: "5551234567",
        datetime: new Date(2025, 10, 22, 9, 30),
        duration: 245,
        status: "completed",
        isEmergency: false,
        intent: "Appointment Booking",
        sentiment: "positive",
        transcript: [
            { timestamp: "00:00", speaker: "AI", text: "Hello, thank you for calling Memorial Hospital. How can I help you today?" },
            { timestamp: "00:05", speaker: "Caller", text: "Hi, I'd like to schedule an appointment with Dr. Johnson." },
            { timestamp: "00:12", speaker: "AI", text: "I can certainly help you with that. What type of appointment are you looking to schedule?" },
            { timestamp: "00:18", speaker: "Caller", text: "It's for a follow-up regarding my blood work results." },
            { timestamp: "00:25", speaker: "AI", text: "I understand. Let me check Dr. Johnson's availability. What days work best for you?" },
            { timestamp: "00:32", speaker: "Caller", text: "I'm flexible this week, preferably in the afternoon." },
            { timestamp: "00:38", speaker: "AI", text: "Perfect. I have availability on Thursday at 2:30 PM or Friday at 3:00 PM. Which would you prefer?" },
            { timestamp: "00:48", speaker: "Caller", text: "Thursday at 2:30 works great." },
            { timestamp: "00:52", speaker: "AI", text: "Excellent. I've scheduled your appointment with Dr. Johnson for Thursday, November 28th at 2:30 PM. You'll receive a confirmation text shortly. Is there anything else I can help you with?" },
            { timestamp: "01:05", speaker: "Caller", text: "No, that's all. Thank you!" },
            { timestamp: "01:08", speaker: "AI", text: "You're welcome! Have a great day." },
        ],
        aiSummary: "Caller requested an appointment scheduling with Dr. Johnson for blood work follow-up. Successfully scheduled for Thursday, November 28th at 2:30 PM. Positive interaction with no issues detected.",
        detectedKeywords: ["appointment", "Dr. Johnson", "blood work", "follow-up", "Thursday"],
    },
};

export default async function CallDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await currentUser();
    const { id } = await params;

    if (!user) {
        redirect("/sign-in");
    }

    const call = mockCallDetails[id];

    if (!call) {
        notFound();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard/calls"
                        className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
                    >
                        ← Back to Calls
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Call Details</h1>
                    <p className="text-muted-foreground">
                        Detailed information and transcript
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                    </Button>
                </div>
            </div>

            {/* Call Metadata */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Call Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium">Caller</p>
                                <p className="text-2xl font-bold">{call.callerName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatPhoneNumber(call.callerPhone)}
                                </p>
                            </div>
                            {call.isEmergency && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Emergency
                                </Badge>
                            )}
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Date</p>
                                <p className="text-sm">{format(call.datetime, "MMMM d, yyyy")}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Time</p>
                                <p className="text-sm">{format(call.datetime, "h:mm a")}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                                <p className="text-sm flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(call.duration)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                <Badge variant={call.status === "completed" ? "success" : "secondary"}>
                                    {call.status}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>AI Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Intent</p>
                            <Badge variant="outline" className="text-sm">{call.intent}</Badge>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Sentiment</p>
                            <Badge
                                variant={
                                    call.sentiment === "positive"
                                        ? "success"
                                        : call.sentiment === "negative"
                                            ? "destructive"
                                            : "secondary"
                                }
                            >
                                {call.sentiment}
                            </Badge>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Detected Keywords</p>
                            <div className="flex flex-wrap gap-2">
                                {call.detectedKeywords.map((keyword: string) => (
                                    <Badge key={keyword} variant="secondary" className="text-xs">
                                        {keyword}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">AI Summary</p>
                            <p className="text-sm">{call.aiSummary}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Transcript */}
            <Card>
                <CardHeader>
                    <CardTitle>Call Transcript</CardTitle>
                    <CardDescription>
                        Full conversation transcript with timestamps
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {call.transcript.map((entry: any, index: number) => (
                            <div key={index} className="flex gap-4">
                                <div className="w-16 flex-shrink-0">
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {entry.timestamp}
                                    </p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium mb-1">
                                        {entry.speaker === "AI" ? (
                                            <span className="text-primary-600">AI Assistant</span>
                                        ) : (
                                            <span>{call.callerName}</span>
                                        )}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{entry.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
