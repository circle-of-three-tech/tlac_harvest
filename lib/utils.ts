// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LeadStatus, SoulState, AgeRange, ChurchMembership } from "@prisma/client"; 

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAttendanceStatus(months: number): {
  label: string;
  color: string;
  bg: string;
} { 
  if (months >= 3) return { label: "Hot", color: "text-white", bg: "bg-red-400" };
  if (months >= 2) return { label: "Lukewarm", color: "text-yellow-700", bg: "bg-yellow-100" };
  return { label: "Cold", color: "text-blue-700", bg: "bg-blue-100" };
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW_LEAD: "New Lead",
  FOLLOWING_UP: "Following Up",
  CONVERTED: "Converted",
};

export const SOUL_STATE_LABELS: Record<SoulState, string> = {
  NEW_CONVERT: "New Convert",
  UNCHURCHED_BELIEVER: "Un-churched Believer",
  HUNGRY_BELIEVER: "Hungry Believer",
};

export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  UNDER_18: "Under 18",
  AGE_18_25: "18 – 25",
  AGE_26_35: "26 – 35",
  AGE_36_45: "36 – 45",
  AGE_46_60: "46 – 60",
  ABOVE_60: "Above 60",
};

export const CHURCH_LABELS: Record<ChurchMembership, string> = {
  TLAC: "TLAC",
  KSOD: "KSOD",
  BOTH_TLAC_AND_KSOD: "Both TLAC & KSOD",
  OTHERS: "Others",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW_LEAD: "#f97316",
  FOLLOWING_UP: "#3b82f6",
  CONVERTED: "#22c55e",
};

export const SOUL_STATE_COLORS: Record<SoulState, string> = {
  NEW_CONVERT: "#ef4444",
  UNCHURCHED_BELIEVER: "#f59e0b",
  HUNGRY_BELIEVER: "#10b981",
};
