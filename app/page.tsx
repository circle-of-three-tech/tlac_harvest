// app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const role = (session.user as any).role;
  if (role === "ADMIN") redirect("/dashboard/admin");
  if (role === "FOLLOWUP") redirect("/dashboard/followup");
  redirect("/dashboard/evangelist");
}
