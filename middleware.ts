import { auth } from "@/lib/auth";
import { UserWithRole } from "@/types/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define protected routes and their required roles
const protectedRoutes = [
  {
    path: "/dashboard/teacher",
    roles: ["TEACHER"],
  },
  {
    path: "/dashboard/student",
    roles: ["STUDENT"],
  },
  {
    path: "/dashboard/admin",
    roles: ["ADMIN"],
  },
  {
    path: "/api/teachers",
    roles: ["STUDENT", "ADMIN"],
    methods: ["GET"],
  },
  {
    path: "/api/bookings",
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
  {
    path: "/api/sessions",
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
  {
    path: "/api/reviews",
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
  {
    path: "/api/materials",
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
  {
    path: "/api/orders",
    roles: ["STUDENT", "ADMIN"],
  },
  {
    path: "/api/payouts",
    roles: ["TEACHER", "ADMIN"],
  },
  {
    path: "/api/admin",
    roles: ["ADMIN"],
  },
];

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  
  // Check if the route is protected
  const protectedRoute = protectedRoutes.find(route => 
    request.nextUrl.pathname.startsWith(route.path)
  );
  
  if (protectedRoute) {
    // If user is not authenticated, redirect to sign-in
    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    
    // Check if user has required role
    const userRole = (session.user as UserWithRole).role;
    if (protectedRoute.roles && !protectedRoute.roles.includes(userRole)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    
    // Check if method is allowed (if specified)
    if (protectedRoute.methods && !protectedRoute.methods.includes(request.method)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }
  
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};