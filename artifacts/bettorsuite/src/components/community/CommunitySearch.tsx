import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";

interface CommunityUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followersCount: number;
  isFollowing: boolean;
  nickname: string | null;
  presenceStatus: PresenceStatus;
}

interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
}

interface CommunitySearchProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function CommunitySearch({
  query,
  onQueryChange,
}: CommunitySearchProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const normalizedQuery = query.trim();
  const searchEnabled = normalizedQuery.length >= 2;

  const users = useQuery({
    queryKey: ["community-user-search", normalizedQuery],
    queryFn: () =>
      api<CommunityUser[]>(
        `/users?search=${encodeURIComponent(normalizedQuery)}`,
      ),
    enabled: searchEnabled,
    refetchInterval: searchEnabled ? 30_000 : false,
  });
  const groups = useQuery({
    queryKey: ["community-group-search", normalizedQuery],
    queryFn: () =>
      api<CommunityGroup[]>(
        `/groups?search=${encodeURIComponent(normalizedQuery)}`,
      ),
    enabled: searchEnabled,
  });
  const follow = useMutation({
    mutationFn: ({ id, isFollowing }: Pick<CommunityUser, "id" | "isFollowing">) =>
      api(`/users/${id}/follow`, { method: isFollowing ? "DELETE" : "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["community-user-search"] }),
  });

  const hasResults = Boolean(users.data?.length || groups.data?.length);
  const searching = users.isLoading || groups.isLoading;

  return (
    <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.035] shadow-sm shadow-black/10">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 sm:w-64">
            <h2 className="font-display text-base font-bold">Find your circle</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Search bettors to follow or groups to join.
            </p>
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search bettors and groups..."
              aria-label="Search bettors and groups"
              className="h-11 border-border bg-background/70 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:border-primary/50"
            />
          </div>
        </div>

        {searchEnabled && (
          <div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-2">
            <section aria-labelledby="people-results-heading">
              <div className="mb-2 flex items-center justify-between">
                <h3
                  id="people-results-heading"
                  className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Bettors
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {users.data?.length ?? 0} found
                </span>
              </div>
              <div className="space-y-2">
                {users.data?.slice(0, 5).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${person.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="relative inline-flex"><Avatar className="h-9 w-9">
                        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback>
                          {(person.nickname ?? person.displayName ?? person.username)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar><PresenceIndicator status={person.presenceStatus} size="md" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {person.nickname || person.displayName || person.username}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{person.username} · {person.followersCount} followers
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant={person.isFollowing ? "secondary" : "outline"}
                      disabled={follow.isPending}
                      onClick={() => follow.mutate(person)}
                      className="shrink-0"
                    >
                      {person.isFollowing ? (
                        <UserCheck className="mr-1.5 h-4 w-4" />
                      ) : (
                        <UserPlus className="mr-1.5 h-4 w-4" />
                      )}
                      {person.isFollowing ? "Following" : "Follow"}
                    </Button>
                  </div>
                ))}
                {!searching && !users.data?.length && (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No bettors match that search.
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="group-results-heading">
              <div className="mb-2 flex items-center justify-between">
                <h3
                  id="group-results-heading"
                  className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Groups
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {groups.data?.length ?? 0} found
                </span>
              </div>
              <div className="space-y-2">
                {groups.data?.slice(0, 5).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => navigate(`/groups/${group.id}?from=community`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-2.5 text-left transition-colors hover:border-primary/35 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{group.name}</span>
                        {group.isMember && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                            Member
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                        {group.description ? ` · ${group.description}` : ""}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {!searching && !groups.data?.length && (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No groups match that search.
                  </p>
                )}
              </div>
            </section>

            {!searching && !hasResults && (
              <p className="sr-only" role="status">
                No community results found.
              </p>
            )}
          </div>
        )}
        {!searchEnabled && query.length > 0 && (
          <p className="mt-2 text-right text-[11px] text-muted-foreground">
            Type at least 2 characters to search.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
