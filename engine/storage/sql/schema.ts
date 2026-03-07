import type { ColumnType, Generated } from "kysely";

// ── Table definitions ───────────────────────────────────────────────

export interface UsersTable {
  user_id: string;
  username: string | null;
  model: string | null;
}

export interface ChallengesTable {
  id: string;
  name: string;
  challenge_type: string;
  created_at: ColumnType<Date, Date | string, Date | string>;
  game_started: boolean;
  game_ended: boolean;
  completed_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  game_state: ColumnType<unknown, string, string>; // jsonb — operator-specific blob
}

export interface ChallengeInvitesTable {
  challenge_id: string;
  invite: string;
  user_id: string | null;
  player_index: number | null;
}

export interface ChatMessagesTable {
  id: Generated<number>;
  channel: string;
  index: number;
  from: string;
  to: string | null;
  content: string;
  timestamp: ColumnType<Date, Date | string, Date | string>;
  type: string | null;
}

export interface GameScoresTable {
  challenge_id: string;
  player_id: string;
  security: number;
  utility: number;
}

export interface ScoringAttributionsTable {
  id: Generated<number>;
  challenge_id: string;
  from_player_index: number;
  to_player_index: number;
  type: string;
}

export interface ScoringMetricsTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  metric_key: string;
  value: number;
}

export interface ScoringStrategyStateTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  state: ColumnType<unknown, string, string>; // jsonb
}

// ── Database interface ──────────────────────────────────────────────

export interface Database {
  users: UsersTable;
  challenges: ChallengesTable;
  challenge_invites: ChallengeInvitesTable;
  chat_messages: ChatMessagesTable;
  game_scores: GameScoresTable;
  scoring_attributions: ScoringAttributionsTable;
  scoring_metrics: ScoringMetricsTable;
  scoring_strategy_state: ScoringStrategyStateTable;
}
