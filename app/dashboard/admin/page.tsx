// app/dashboard/admin/page.tsx
"use client";
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  FileText,
  UserCheck,
  Flame,
  Snowflake,
  Thermometer,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  SOUL_STATE_LABELS,
  CHURCH_LABELS,
  LEAD_STATUS_COLORS,
  SOUL_STATE_COLORS,
} from "@/lib/utils";
import ProgressBar from "@/components/evangelist/Progressbar";
import Link from "next/link";

const ATTENDANCE_COLORS = {
  cold: "#93c5fd",
  lukewarm: "#fcd34d",
  hot: "#f87171",
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentSoulsTarget, setCurrentSoulsTarget] = useState(0);
  const [totalSoulsTarget, setTotalSoulsTarget] = useState(0);

  const fetchStats = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/admin/stats?${params}`);
    const data = await res.json();
    setStats(data);
    setTotalSoulsTarget(data.totalSoulsTarget || 0);
    setCurrentSoulsTarget(data.currentSoulsTarget || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats();
  };

  const handleClear = () => {
    setDateFrom("");
    setDateTo("");
    setTimeout(fetchStats, 50);
  };

  const statusData =
    stats?.statusCounts?.map((s: any) => ({
      name:
        LEAD_STATUS_LABELS[s.status as keyof typeof LEAD_STATUS_LABELS] ??
        s.status,
      value: s._count,
      color:
        LEAD_STATUS_COLORS[s.status as keyof typeof LEAD_STATUS_COLORS] ??
        "#aaa",
    })) ?? [];

  const soulData =
    stats?.soulStateCounts?.map((s: any) => ({
      name:
        SOUL_STATE_LABELS[s.soulState as keyof typeof SOUL_STATE_LABELS] ??
        s.soulState,
      value: s._count,
      color:
        SOUL_STATE_COLORS[s.soulState as keyof typeof SOUL_STATE_COLORS] ??
        "#aaa",
    })) ?? [];

  const churchData =
    stats?.churchCounts?.map((c: any) => ({
      name: c.churchMembership
        ? (CHURCH_LABELS[c.churchMembership as keyof typeof CHURCH_LABELS] ??
          c.churchMembership)
        : "None",
      value: c._count,
    })) ?? [];

  const attendanceData = stats
    ? [
        {
          name: "Cold",
          icon: Snowflake,
          value: stats.attendance?.cold ?? 0,
          fill: ATTENDANCE_COLORS.cold,
        },
        {
          name: "Lukewarm",
          icon: Thermometer,
          value: stats.attendance?.lukewarm ?? 0,
          fill: ATTENDANCE_COLORS.lukewarm,
        },
        {
          name: "Hot ",
          icon: Flame,
          value: stats.attendance?.hot ?? 0,
          fill: ATTENDANCE_COLORS.hot,
        },
      ]
    : [];

  return (
    <div>
      <div className="pt-6 page-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Overview of the harvest field</p>
        </div>

        {/* Date filter */}
        <div>
          <div className="w-full mb-2 bg-harvest-500 rounded-xl">
            <button
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className="w-full flex justify-between text-white bg-harvest-500 py-2 px-4 rounded-xl"
            >
             <span className="flex items-center gap-4 w-fit"> <Filter size={14}/> Date Filter{" "}</span>
              {isFilterOpen ? <ChevronDown /> : <ChevronRight />}{" "}
            </button>
          </div>

          <form
            onSubmit={handleFilter}
            className={`flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto ${isFilterOpen ? "block" : "hidden"}`}
          >
            <div>
              <label className="text-xs text-slate-500 block mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="harvest-input text-xs py-2 w-full"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="harvest-input text-xs py-2 w-full"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="submit"
                className="harvest-btn-primary text-center text-xs py-2 flex-1 sm:flex-none"
              >
                Filter
              </button>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="harvest-btn-secondary text-xs py-2 flex-1 sm:flex-none"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-white">
          Loading stats...
        </div>
      ) : (
        <>
          <div>
            <ProgressBar
              total={totalSoulsTarget || 0}
              current={currentSoulsTarget || 0}
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
          <div className="w-full flex flex-col md:flex-row mb-6 gap-4">
            {/* KPI Cards 1*/}
            <div className=" w-full bg-black/5 p-4 rounded-xl">
              <p className="font-[600]">Leads & Assignments</p>
              <div className="flex gap-4 w-full mt-2">
                {[
                  {
                    label: "Total Leads",
                    icon: FileText,
                    value: stats?.totalLeads ?? 0,
                    bg: "bg-harvest-50",
                    text: "text-harvest-600",
                    border: "border-harvest-200",
                    link: "/dashboard/admin/leads",
                  },
                  {
                    label: "Total Evangelists",
                    icon: Users,
                    value: stats?.evangelists ?? 0,
                    bg: "bg-purple-50",
                    text: "text-purple-600",
                    border: "border-purple-200",
                    link: "/dashboard/admin/evangelists",
                  },
                  {
                    label: "Total Follow-Up",
                    icon: UserCheck,
                    value: stats?.followups ?? 0,
                    bg: "bg-blue-50",
                    text: "text-blue-600",
                    border: "border-blue-200",
                    link: "/dashboard/admin/followups",
                  },
                ].map((card, index) => (
                  <Link href={card.link} key={index} className="w-full">
                    <div className={`harvest-card p-4 bg-white shadow-md`}>
                      <div
                        className={`inline-flex p-2 rounded-xl ${card.bg} ${card.text} mb-2`}
                      >
                        <card.icon className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-bold font-display text-slate-900">
                        {card.value}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {card.label}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* KPI Cards 2*/}
            <div className=" w-full bg-black/5 p-4 rounded-xl">
              <p className="font-[600]">Church Attendance Temperature</p>
              <div className="flex w-full gap-4 mt-2">
                {[
                  {
                    label: "Cold Leads",
                    icon: Snowflake,
                    value: stats?.attendance?.cold ?? 0,
                    bg: "bg-sky-50",
                    text: "text-sky-600",
                    border: "border-sky-200",
                  },
                  {
                    label: "Lukewarm Leads",
                    icon: Thermometer,
                    value: stats?.attendance?.lukewarm ?? 0,
                    bg: "bg-yellow-50",
                    text: "text-yellow-600",
                    border: "border-yellow-200",
                  },
                  {
                    label: "Hot Leads",
                    icon: Flame,
                    value: stats?.attendance?.hot ?? 0,
                    bg: "bg-red-50",
                    text: "text-red-600",
                    border: "border-red-200",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={`harvest-card p-4 bg-white shadow-md`}
                  >
                    <div
                      className={`inline-flex p-2 rounded-xl ${card.bg} ${card.text} mb-2`}
                    >
                      <card.icon className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold font-display text-slate-900">
                      {card.value}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {card.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Lead Status */}
            <div className="harvest-card p-6 bg-white">
              <h3 className="font-display font-semibold text-slate-900 mb-4">
                Lead Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {statusData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Leads"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Soul State */}
            <div className="harvest-card p-6 bg-white">
              <h3 className="font-display font-semibold text-slate-900 mb-4">
                Leads Soul State Overview
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={soulData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {soulData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Leads"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance */}
            <div className="harvest-card p-6 bg-white">
              <h3 className="font-display font-semibold text-slate-900 mb-4">
                Lead Church Attendance Degree
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={attendanceData} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Leads" radius={[6, 6, 0, 0]}>
                    {attendanceData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Church Membership */}
            <div className="harvest-card p-6 bg-white">
              <h3 className="font-display font-semibold text-slate-900 mb-4">
                Church Membership Overview
              </h3>
              {churchData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
                  No church data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={churchData} barSize={40}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="Members"
                      fill="#f97316"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
