"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { UserWithRole } from "@/types/auth";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session?.user) {
      if ((session.user as UserWithRole).role === "TEACHER") {
        router.push("/dashboard/teacher");
      } else if ((session.user as UserWithRole).role === "STUDENT") {
        router.push("/dashboard/student");
      } else if ((session.user as UserWithRole).role === "ADMIN") {
        router.push("/dashboard/admin");
      } else {
        router.push("/onboarding");
      }
    }
  }, [session, isPending, router]);

  if (isPending) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <div className="min-h-screen flex items-center justify-center">Redirecting...</div>;
}