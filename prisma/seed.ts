// prisma/seed.ts
import { PrismaClient, Role, SMSType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Salvation123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@harvest.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@harvest.com",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  // Seed default SMS templates
  await prisma.sMSTemplate.upsert({
    where: { type: SMSType.NEW_LEAD_NOTIFICATION },
    update: {},
    create: {
      type: SMSType.NEW_LEAD_NOTIFICATION,
      title: "New Lead Welcome Message",
      content: `Hi {leadName}. TLAC/KSOD is glad to have you as a member. And guide you through your journey to God. If you have any questions, feel free to reach out.`,
      createdById: admin.id,
    },
  });

  await prisma.sMSTemplate.upsert({
    where: { type: SMSType.ADMIN_ALERT },
    update: {},
    create: {
      type: SMSType.ADMIN_ALERT,
      title: "Admin Lead Alert",
      content: `New lead added: {leadName} ({phone}) from {location}. Status: {status}`,
      createdById: admin.id,
    },
  });

  await prisma.sMSTemplate.upsert({
    where: { type: SMSType.FOLLOWUP_ASSIGNMENT },
    update: {},
    create: {
      type: SMSType.FOLLOWUP_ASSIGNMENT,
      title: "Lead Assignment Notification",
      content: `Hi {assigneeName}, a new lead has been assigned to you: {leadName} from {location}. Phone: {phone}`,
      createdById: admin.id,
    },
  });

  console.log("✅ Seed complete. Admin: admin@harvest.com / password: Salvation123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
