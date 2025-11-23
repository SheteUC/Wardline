import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { WorkflowEditor } from "@/components/workflow-editor";

export const dynamic = "force-dynamic";

// Mock workflow data
const mockWorkflows: Record<string, { id: string; name: string }> = {
    "1": { id: "1", name: "New Patient Intake" },
    "2": { id: "2", name: "Emergency Triage" },
    "3": { id: "3", name: "Appointment Rescheduling" },
    "new": { id: "new", name: "New Workflow" },
};

export default async function WorkflowEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await currentUser();
    const { id } = await params;

    if (!user) {
        redirect("/sign-in");
    }

    const workflow = mockWorkflows[id];

    if (!workflow) {
        notFound();
    }

    return <WorkflowEditor workflowId={workflow.id} workflowName={workflow.name} />;
}
