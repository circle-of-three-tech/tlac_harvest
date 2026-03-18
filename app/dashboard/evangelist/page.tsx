// app/dashboard/evangelist/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EvangelistDashboardClient from "./EvangelistDashboardClient";

export default async function EvangelistDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const user = session.user as any;
  if (user.role === "ADMIN") redirect("/dashboard/admin");
  if (user.role === "FOLLOWUP") redirect("/dashboard/followup");
 

  // Fetch total counts for stats
  const totalLeads = await prisma.lead.count({
    where: { addedById: user.id },
  });

  const newLeadsCount = await prisma.lead.count({
    where: { addedById: user.id, status: "NEW_LEAD" },
  });

  const followingUpCount = await prisma.lead.count({
    where: { addedById: user.id, status: "FOLLOWING_UP" },
  });

  const convertedCount = await prisma.lead.count({
    where: { addedById: user.id, status: "CONVERTED" },
  });

  // Fetch recent leads for display
  const leads = await prisma.lead.findMany({
    where: { addedById: user.id },
    include: {
      addedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const usr = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      gender: true,
      noOfSoulsTarget: true
    },
  });

  const stats = {
    total: totalLeads,
    newLeads: newLeadsCount,
    followingUp: followingUpCount,
    converted: convertedCount,
  };

  return <EvangelistDashboardClient leads={JSON.parse(JSON.stringify(leads))} stats={stats} userName={user.name} gender={usr?.gender} noOfSoulsTarget={usr?.noOfSoulsTarget} />;
}
