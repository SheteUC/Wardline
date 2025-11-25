import { DashboardLayout } from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { QueryProvider } from "@/lib/query-provider";
import { HospitalProvider } from "@/lib/hospital-context";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <QueryProvider>
            <HospitalProvider>
                <DashboardLayout>{children}</DashboardLayout>
            </HospitalProvider>
        </QueryProvider>
    );
}
