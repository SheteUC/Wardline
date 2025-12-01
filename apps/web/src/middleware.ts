import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/privacy",
    "/terms",
    "/contact",
]);

// Define role-specific route matchers
const isPatientRoute = createRouteMatcher(["/patient(.*)"]);
const isSystemAdminRoute = createRouteMatcher(["/admin/system(.*)"]);
const isCallCenterRoute = createRouteMatcher(["/admin/call-center(.*)"]);
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, request) => {
    // Protect all routes except public ones
    if (!isPublicRoute(request)) {
        await auth.protect();
    }

    // Get user session for role-based routing
    const { userId, sessionClaims } = await auth();
    
    if (!userId) return;

    // Extract role from session claims (set via Clerk metadata)
    const userRole = sessionClaims?.metadata?.role as string | undefined;
    const url = request.nextUrl.clone();

    // Role-based access control
    // Patient routes - only for patients
    if (isPatientRoute(request)) {
        if (userRole !== 'patient') {
            // Non-patients trying to access patient portal get redirected
            // In production, you might want to show an access denied page
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    // System admin routes - only for system_admin role
    if (isSystemAdminRoute(request)) {
        if (userRole !== 'system_admin') {
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    // Call center routes - for admin, supervisor, or owner roles
    if (isCallCenterRoute(request)) {
        const allowedRoles = ['admin', 'supervisor', 'owner', 'system_admin'];
        if (!allowedRoles.includes(userRole || '')) {
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    // Dashboard routes - for hospital staff (not patients)
    if (isDashboardRoute(request)) {
        if (userRole === 'patient') {
            url.pathname = '/patient';
            return NextResponse.redirect(url);
        }
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
