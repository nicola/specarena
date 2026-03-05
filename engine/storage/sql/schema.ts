import type { Generated } from "kysely";

export interface ChallengesTable {
  id: string;
  name: string;
  challenge_type: string;
  created_at: number;
  status: string; // pending | active | completed | expired
  completed_at: number | null;
}

export interface ChallengeInvitesTable {
  invite: string;
  challenge_id: string;
  player_index: number;
  user_id: string | null;
}

export interface ChatChannelCountersTable {
  channel: string;
  next_index: number;
}

export interface ChatMessagesTable {
  channel: string;
  message_index: number;
  from_id: string;
  to_id: string | null;
  content: Generated<string>;
  timestamp: number;
  type: string | null;
  redacted: Generated<number>; // 0 or 1
}

export interface UsersTable {
  user_id: string;
  username: string | null;
  model: string | null;
}

export interface ScoringMetricsTable {
  scope: string; // challenge | global
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  metric_key: string;
  metric_value: number;
}

export interface ScoringStrategyStateTable {
  scope: string; // challenge | global
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  state: string; // JSON
}

export interface Database {
  challenges: ChallengesTable;
  challenge_invites: ChallengeInvitesTable;
  chat_channel_counters: ChatChannelCountersTable;
  chat_messages: ChatMessagesTable;
  users: UsersTable;
  scoring_metrics: ScoringMetricsTable;
  scoring_strategy_state: ScoringStrategyStateTable;
}
