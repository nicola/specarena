import type { Generated } from "kysely";

export interface ChatMessagesTable {
  id: Generated<number>;
  channel: string;
  idx: number | null;
  from_id: string;
  to_id: string | null;
  content: string;
  timestamp: number;
  type: string | null;
  redacted: 0 | 1;
}

export interface ChannelCountersTable {
  channel: string;
  counter: number;
}

export interface UsersTable {
  user_id: string;
  username: string | null;
  model: string | null;
}

export interface ScoreEntriesTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  games_played: number;
  metrics: string; // JSON text
}

export interface GlobalScoreEntriesTable {
  player_id: string;
  games_played: number;
  metrics: string; // JSON text
}

export interface StrategyStateTable {
  challenge_type: string;
  strategy_name: string;
  player_id: string;
  state: string; // JSON text
}

export interface GlobalStrategyStateTable {
  player_id: string;
  state: string; // JSON text
}

export interface Database {
  chat_messages: ChatMessagesTable;
  channel_counters: ChannelCountersTable;
  users: UsersTable;
  score_entries: ScoreEntriesTable;
  global_score_entries: GlobalScoreEntriesTable;
  strategy_state: StrategyStateTable;
  global_strategy_state: GlobalStrategyStateTable;
}
