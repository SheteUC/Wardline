import { DashboardLayout } from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { QueryProvider } from "@/lib/query-provider";
import { BusinessProvider } from "@/lib/business-context";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <QueryProvider>
            <BusinessProvider>
                <DashboardLayout>{children}</DashboardLayout>
            </BusinessProvider>
        </QueryProvider>
    );
}
