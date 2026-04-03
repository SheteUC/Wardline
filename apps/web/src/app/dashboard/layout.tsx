import { DashboardLayout } from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { BusinessProvider } from "@/lib/business-context";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <BusinessProvider>
            <AuthProvider>
                <DashboardLayout>{children}</DashboardLayout>
            </AuthProvider>
        </BusinessProvider>
    );
}
