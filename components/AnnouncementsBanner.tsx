// components/AnnouncementsBanner.tsx
"use client";
import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRole: string;
  expiryDate: string;
  createdAt: string;
}

export default function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(false);
      const res = await fetch("/api/announcements");
      if (!res.ok) throw new Error("Failed to fetch announcements");
      const data = await res.json();
      setAnnouncements(data);
    } catch (error) {
      console.error("Failed to load announcements:", error);
      setLoading(false);
    }
  };

  const visibleAnnouncements = announcements.filter(
    (a) => !dismissed.includes(a.id),
  );

  if (loading || visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.id}
          className="bg-harvest-800 border border-harvest-700/50 rounded-lg p-4 flex gap-3 items-start"
        >
          <div className="flex-1 min-w-0">
            <h3 className="flex flex-shrink-0 gap-2 animate-pulse items-center font-semibold uppercase text-harvest-200 text-sm my-4">
              <Bell className="fill-harvest-200" size={20} />
              Announcement From Pastor!
            </h3>
            <h3 className="font-semibold text-harvest-50 text-sm">
              {announcement.title}
            </h3>
            <p className="text-slate-50 text-sm mt-1 break-words">
              {announcement.content}
            </p>
            {/* <p className="text-slate-50 text-xs mt-2">
              Expires:{" "}
              {new Date(announcement.expiryDate).toLocaleDateString()} at{" "}
              {new Date(announcement.expiryDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p> */}
          </div>
          <button
            onClick={() => {
              setDismissed((prev) => [...prev, announcement.id]);
            }}
            className="text-white hover:text-harvest-300 transition flex-shrink-0"
            title="Dismiss"
          >
            <X size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}
