import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpRight, MessagesSquare, UsersRound } from "lucide-react";
import { api } from "@/lib/api";

interface MessageGroup {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  role: string | null;
}

export function GroupInboxList() {
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<MessageGroup[]>("/groups"),
  });
  const joinedGroups = (groups.data ?? []).filter((group) => group.isMember);

  if (groups.isLoading) {
    return <div className="px-4 py-10 text-center text-sm text-slate-500">Loading group chats…</div>;
  }

  if (!joinedGroups.length) {
    return (
      <div className="px-4 py-10 text-center">
        <UsersRound className="mx-auto h-7 w-7 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-700">No joined groups yet</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Join or create a group in Community and its chat will appear here.
        </p>
        <Link href="/community">
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50">
            Browse Community
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {joinedGroups.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`}>
          <div className="group flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:bg-blue-50">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-slate-900">{group.name}</span>
                {group.role === "admin" && (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700">
                    Admin
                  </span>
                )}
              </div>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · Group chat
              </span>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-600" />
          </div>
        </Link>
      ))}
    </div>
  );
}
