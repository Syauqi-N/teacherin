import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Define role-based access rules
const roleAccessRules = {
  STUDENT: ["/dashboard/student", "/bookings", "/reviews"],
  TEACHER: ["/dashboard/teacher", "/bookings", "/sessions", "/materials"],
  ADMIN: ["/dashboard/admin", "/admin"],
};

// Middleware to check role-based access
export async function checkRoleAccess(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const role = (session.user as any).role as string;
  const pathname = request.nextUrl.pathname;

  // Check if the user's role has access to this path
  const allowedPaths = roleAccessRules[role as keyof typeof roleAccessRules] || [];
  const hasAccess = allowedPaths.some((path) => pathname.startsWith(path));

  if (!hasAccess) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}