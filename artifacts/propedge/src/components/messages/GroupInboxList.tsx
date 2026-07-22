import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowUpRight,
  BellOff,
  Check,
  MailPlus,
  MessagesSquare,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface MessageGroup {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  role: string | null;
  notificationsMuted: boolean;
  unreadCount: number;
}

interface PendingGroupInvite {
  id: number;
  groupId: number;
  groupName: string;
  groupDescription: string | null;
  invitedByUsername: string;
  memberCount: number;
  createdAt: string;
}

export function GroupInboxList() {
  const queryClient = useQueryClient();
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<MessageGroup[]>("/groups"),
    refetchInterval: 4000,
  });
  const invites = useQuery({
    queryKey: ["group-invites"],
    queryFn: () => api<PendingGroupInvite[]>("/groups/invites/pending"),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["group-invites"] });
  };
  const acceptInvite = useMutation({
    mutationFn: (invite: PendingGroupInvite) =>
      api(`/groups/${invite.groupId}/join`, { method: "POST" }),
    onSuccess: (_, invite) => {
      refresh();
      toast.success(`Joined ${invite.groupName}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not join group",
      ),
  });
  const declineInvite = useMutation({
    mutationFn: (invite: PendingGroupInvite) =>
      api(`/groups/invites/${invite.id}/decline`, { method: "POST" }),
    onSuccess: (_, invite) => {
      refresh();
      toast.success(`Invitation to ${invite.groupName} declined`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not decline invitation",
      ),
  });
  const joinedGroups = (groups.data ?? []).filter((group) => group.isMember);
  const pendingInvites = invites.data ?? [];

  if (groups.isLoading || invites.isLoading) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-500">
        Loading group chats…
      </div>
    );
  }

  if (!joinedGroups.length && !pendingInvites.length) {
    return (
      <div className="px-4 py-10 text-center">
        <UsersRound className="mx-auto h-7 w-7 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-700">
          No joined groups yet
        </p>
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
    <div className="space-y-4">
      {pendingInvites.length > 0 && (
        <section aria-label="Pending group invitations" className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Invitations
            </span>
            <span className="rounded-full bg-blue-600 px-2 py-0.5 font-mono text-[9px] font-bold text-white">
              {pendingInvites.length}
            </span>
          </div>
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <MailPlus className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {invite.groupName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Invited by @{invite.invitedByUsername} ·{" "}
                    {invite.memberCount}{" "}
                    {invite.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
              </div>
              {invite.groupDescription && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                  {invite.groupDescription}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={acceptInvite.isPending || declineInvite.isPending}
                  onClick={() => acceptInvite.mutate(invite)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Join
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 bg-white text-xs"
                  disabled={acceptInvite.isPending || declineInvite.isPending}
                  onClick={() => declineInvite.mutate(invite)}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}
      {joinedGroups.length > 0 && (
        <div className="space-y-1">
          {pendingInvites.length > 0 && (
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Your groups
            </div>
          )}
          {joinedGroups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}?from=messages`}>
              <div className="group flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:bg-blue-50">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                  <MessagesSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">
                      {group.name}
                    </span>
                    {group.role === "admin" && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700">
                        Admin
                      </span>
                    )}
                    {group.notificationsMuted && (
                      <BellOff
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-label="Group notifications muted"
                      />
                    )}
                    {group.unreadCount > 0 && !group.notificationsMuted && (
                      <span className="ml-auto rounded-full bg-blue-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                        {group.unreadCount > 99 ? "99+" : group.unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {group.memberCount}{" "}
                    {group.memberCount === 1 ? "member" : "members"} · Group
                    chat
                  </span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
