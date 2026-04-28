// components/leads/LeadCommentsPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageCircle, Shield, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";

interface Participant {
  id: string;
  name: string;
  role: "FOLLOWUP" | "EVANGELIST";
  relation: "ADDED_BY" | "ASSIGNED_TO";
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorRole: "ADMIN" | "FOLLOWUP" | "EVANGELIST";
  readByRecipientAt: string | null;
  author: { id: string; name: string; role: string };
}

interface ThreadState {
  counterpartId: string | null;
  participants: Participant[];
  comments: Comment[];
  unreadByCounterpart: Record<string, number>;
  viewer: { id: string; role: "ADMIN" | "FOLLOWUP" | "EVANGELIST" };
}

const RELATION_LABEL: Record<Participant["relation"], string> = {
  ADDED_BY: "Evangelist",
  ASSIGNED_TO: "Follow-up",
};

export default function LeadCommentsPanel({ leadId }: { leadId: string }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as ThreadState["viewer"]["role"] | undefined;
  const isAdmin = role === "ADMIN";

  const [activeCounterpart, setActiveCounterpart] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async (counterpartId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/leads/${leadId}/comments${
        counterpartId ? `?counterpartId=${encodeURIComponent(counterpartId)}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to load comments");
      }
      const data: ThreadState = await res.json();
      setThread(data);
      setActiveCounterpart(data.counterpartId);

      // Mark thread as read for the current viewer.
      if (data.counterpartId) {
        void fetch(`/api/leads/${leadId}/comments`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counterpartId: data.counterpartId }),
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [thread?.comments?.length]);

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    if (isAdmin && !activeCounterpart) {
      setError("Pick a participant to message.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          ...(isAdmin && activeCounterpart ? { counterpartId: activeCounterpart } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to post comment");
      }
      const created: Comment = await res.json();
      setThread((prev) =>
        prev ? { ...prev, comments: [...prev.comments, created] } : prev,
      );
      setDraft("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const participants = thread?.participants ?? [];
  const noParticipants = !loading && participants.length === 0;

  const placeholder = useMemo(() => {
    if (isAdmin) {
      const cp = participants.find((p) => p.id === activeCounterpart);
      return cp ? `Message ${cp.name}…` : "Pick a participant…";
    }
    return "Message admin…";
  }, [isAdmin, participants, activeCounterpart]);

  return (
    <div className="flex flex-col border border-harvest-100 bg-white rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-harvest-100 flex items-center gap-2 bg-harvest-50">
        <MessageCircle className="w-4 h-4 text-harvest-700" />
        <span className="text-sm font-semibold text-harvest-900">
          {isAdmin ? "Conversations" : "Conversation with Admin"}
        </span>
      </div>

      {/* Admin tab strip */}
      {isAdmin && participants.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-harvest-100">
          {participants.map((p) => {
            const unread = thread?.unreadByCounterpart?.[p.id] ?? 0;
            const active = p.id === activeCounterpart;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveCounterpart(p.id);
                  load(p.id);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 transition ${
                  active
                    ? "bg-harvest-700 text-white border-harvest-700"
                    : "bg-white text-harvest-800 border-harvest-200 hover:bg-harvest-50"
                }`}
              >
                <span>{p.name}</span>
                <span className={`text-[10px] uppercase tracking-wide ${active ? "text-harvest-100" : "text-harvest-500"}`}>
                  {RELATION_LABEL[p.relation]}
                </span>
                {unread > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 max-h-72 min-h-[12rem]">
        {loading && (
          <div className="flex items-center justify-center text-harvest-700/70 text-xs gap-2 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {!loading && noParticipants && (
          <p className="text-xs text-slate-400 italic text-center py-6">
            No follow-up team or evangelist linked to this lead yet.
          </p>
        )}
        {!loading && !noParticipants && (thread?.comments ?? []).length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-6">
            No messages yet. Start the conversation.
          </p>
        )}
        {(thread?.comments ?? []).map((c) => {
          const mine = c.authorId === thread?.viewer.id;
          const fromAdmin = c.authorRole === "ADMIN";
          return (
            <div key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs sm:text-sm shadow-sm ${
                  mine
                    ? "bg-harvest-700 text-white rounded-br-sm"
                    : fromAdmin
                      ? "bg-orange-50 text-orange-900 border border-orange-200 rounded-bl-sm"
                      : "bg-harvest-50 text-harvest-900 border border-harvest-100 rounded-bl-sm"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {fromAdmin && <Shield className="w-3 h-3 opacity-80" />}
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${mine ? "text-harvest-100" : "text-harvest-700/70"}`}>
                    {mine ? "You" : c.author.name}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words">{c.content}</div>
                <div className={`text-[10px] mt-1 ${mine ? "text-harvest-100/80" : "text-harvest-500"}`}>
                  {c.createdAt && !isNaN(new Date(c.createdAt).getTime())
                    ? format(new Date(c.createdAt), "MMM d · p")
                    : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}

      {!noParticipants && (
        <div className="border-t border-harvest-100 p-2 flex items-end gap-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="harvest-input resize-none text-xs flex-1"
            onKeyDown={(e) => {
              if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                send();
              }
            }}
            disabled={posting || (isAdmin && !activeCounterpart)}
          />
          <button
            onClick={send}
            disabled={posting || !draft.trim() || (isAdmin && !activeCounterpart)}
            className="harvest-btn-primary text-xs gap-1.5 disabled:opacity-50"
          >
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      )}
    </div>
  );
}
