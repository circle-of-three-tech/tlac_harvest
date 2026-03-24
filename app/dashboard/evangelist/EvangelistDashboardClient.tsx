// app/dashboard/evangelist/EvangelistDashboardClient.tsx
"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import {
  UserRoundPlus,
  TrendingUp,
  Users,
  Activity,
  CheckCircle,
  Target,
} from "lucide-react";
import LeadTable from "@/components/leads/LeadTable";
import AnnouncementsBanner from "@/components/AnnouncementsBanner";
import AddLeadModal from "@/components/leads/AddLeadModal";
import ProgressBar from "@/components/evangelist/Progressbar";

interface Props {
  leads: any[];
  stats: {
    total: number;
    newLeads: number;
    followingUp: number;
    converted: number;
  };
  userName: string;
  gender: string | null | undefined;
  noOfSoulsTarget: number | null | undefined;
}

export default function EvangelistDashboardClient({
  leads: initialLeads,
  stats,
  userName,
  gender,
  noOfSoulsTarget,
}: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [stats_, setStats] = useState(stats);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refetch fresh data from API
  const refetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const leadsRes = await fetch("/api/leads?limit=1000").then((r) =>
        r.json()
      );
      const freshLeads = leadsRes.leads || leadsRes.data || [];
      
      // Calculate fresh stats from leads
      const freshStats = {
        total: freshLeads.length,
        newLeads: freshLeads.filter((l: any) => l.status === "NEW_LEAD").length,
        followingUp: freshLeads.filter((l: any) => l.status === "FOLLOWING_UP")
          .length,
        converted: freshLeads.filter((l: any) => l.status === "CONVERTED")
          .length,
      };

      setLeads(freshLeads.slice(0, 10));
      setStats(freshStats);
    } catch (error) {
      console.error("Failed to refresh leads:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleLeadAdded = useCallback((newLead: any) => {
    setShowAddModal(false);
    // Optimistic UI update
    setLeads((prev) => [newLead, ...prev].slice(0, 10));
    // Refresh fresh data from server
    refetchData();
  }, [refetchData]);

  const targetRemaining = (noOfSoulsTarget ?? 0) - stats_.total;

  const statCards = [
    {
      label: "My Souls Target",
      value: noOfSoulsTarget,
      icon: Target,
      color: "bg-purple-50 text-purple-600",
      border: "border-purple-200",
    },
    {
      label: "Total Leads Added",
      value: stats_.total,
      icon: Users,
      color: "bg-harvest-50 text-harvest-600",
      border: "border-harvest-200",
    },
    {
      label: "Being Followed Up",
      value: stats_.followingUp,
      icon: TrendingUp,
      color: "bg-blue-50 text-blue-600",
      border: "border-blue-200",
    },
    {
      label: "No Follow Up",
      value: stats_.newLeads,
      icon: Activity,
      color: "bg-orange-50 text-orange-600",
      border: "border-orange-200",
    },
    // { label: "Converted", value: stats_.converted, icon: CheckCircle, color: "bg-green-50 text-green-600", border: "border-green-200" },
  ];

  return (
    <div>
      <div className="pt-12 page-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title">
            Welcome, {gender === "MALE" ? "Bro" : "Sis"}{" "}
            {userName.split(" ")[0]} 👋
          </h1>
          <p className="page-subtitle">Here's a summary of your harvest work</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="harvest-btn-primary w-full sm:w-auto"
        >
          <UserRoundPlus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <AnnouncementsBanner />

      <div>
        <ProgressBar
          total={noOfSoulsTarget || 0}
          current={stats_.total || 0}
          label="Evangelism Progress"
          fillColor="#e4a442"
          trackColor="#fae5bc"
          height={22}
          radius={8}
          showValues
          showPercent
          animated
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`harvest-card p-5 border bg-white shadow-lg`}
          >
            <div className={`inline-flex p-2 rounded-xl ${card.color} mb-3`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold font-display text-slate-900">
              {card.value}
            </div>
            <div className="text-sm text-slate-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Recent leads */}
      <div className="harvest-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-harvest-100">
          <h2 className="font-display font-semibold text-slate-900">
            Recent Leads
          </h2>
          <Link
            href="/dashboard/evangelist/leads"
            className="text-sm text-harvest-600 hover:text-harvest-700 font-medium"
          >
            View all →
          </Link>
        </div>
        <LeadTable
          leads={leads}
          showAssignedTo={false}
          onLeadUpdated={(updated) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l)),
            );
          }}
        />
      </div>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleLeadAdded}
        />
      )}
    </div>
  );
}
