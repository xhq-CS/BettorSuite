import type { SharedBetSnapshot } from "@/components/shared-bets/SharedBetCard";

export interface DailyCard {
  id: number;
  userId: number;
  username: string;
  avatarUrl: string | null;
  title: string;
  note: string | null;
  leagues: string[];
  picks: SharedBetSnapshot[];
  cardDate: string;
  createdAt: string;
}

export interface StreakDay {
  date: string;
  profit: number;
  profitable?: boolean;
}

export interface ProfileStats {
  totalBets: number;
  settledBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  roi: number;
  totalProfit: number;
  streak: StreakDay[];
}

export interface BettorProfile {
  id: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  favoriteSport: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  stats: ProfileStats;
  createdAt: string;
}

export interface PublicPickRevision {
  id: number;
  action: string;
  snapshot: SharedBetSnapshot;
  createdAt: string;
}

export interface PublicPick {
  id: string;
  sourceBetId: number;
  edited: boolean;
  updatedAt: string;
  snapshot: SharedBetSnapshot;
  revisions: PublicPickRevision[];
}

export interface Conversation {
  id: number;
  participantId: number;
  participantUsername: string;
  participantDisplayName: string | null;
  participantAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  notificationsMuted: boolean;
  unreadCount: number;
}

export interface DirectMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderUsername: string;
  senderAvatarUrl: string | null;
  content: string;
  betShare: SharedBetSnapshot | null;
  dailyCard: DailyCard | null;
  createdAt: string;
  editedAt: string | null;
}
