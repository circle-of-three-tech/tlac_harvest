// app/dashboard/layout.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-[var(--harvest-light)]">
      <Sidebar />
      <main className="flex-1 overflow-auto w-full">
        <div className="pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8 animate-fadeIn">
          {children}
        </div>
      </main>
    </div>
  );
}
