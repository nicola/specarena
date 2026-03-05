import type { Generated } from "kysely";

export interface ChallengesTable {
  id: string;
  name: string;
  challenge_type: string;
  created_at: number;
  game_started: Generated<number>; // 0 or 1
  game_ended: Generated<number>;   // 0 or 1
  completed_at: number | null;
  game_state: string | null;       // JSON
}

export interface ChallengeInvitesTable {
  invite: string;
  challenge_id: string;
  player_index: number;
  user_id: string | null;
}

export interface ChallengeScoresTable {
  challenge_id: string;
  player_index: number;
  security: number;
  utility: number;
}

export interface ChallengeAttributionsTable {
  id: Generated<number>;
  challenge_id: string;
  from_idx: number;
  to_idx: number;
  type: string;
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
}

export interface UsersTable {
  user_id: string;
  username: string | null;
  model: string | null;
}

export interface ScoreMetricsTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  metric_key: string;
  metric_value: number;
}

export interface StrategyStateTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  state: string; // JSON
}

export interface Database {
  challenges: ChallengesTable;
  challenge_invites: ChallengeInvitesTable;
  challenge_scores: ChallengeScoresTable;
  challenge_attributions: ChallengeAttributionsTable;
  chat_channel_counters: ChatChannelCountersTable;
  chat_messages: ChatMessagesTable;
  users: UsersTable;
  score_metrics: ScoreMetricsTable;
  strategy_state: StrategyStateTable;
}
