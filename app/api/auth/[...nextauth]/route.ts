// app/api/auth/[...nextauth]/route.ts
export async function generateStaticParams() {
  return [];
}

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
