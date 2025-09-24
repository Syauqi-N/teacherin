import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: new Headers()
  });
  
  if (!session) {
    redirect("/sign-in");
  }
  
  return <>{children}</>;
}