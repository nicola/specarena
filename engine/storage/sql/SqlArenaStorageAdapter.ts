import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ArenaStorageAdapter } from "../InMemoryArenaStorageAdapter";
import type {
  Challenge,
  ChallengeOperator,
  ChallengeOperatorState,
} from "../../types";

function statusFromState(state: ChallengeOperatorState | undefined): string {
  if (!state) return "pending";
  if (state.gameEnded) return "completed";
  if (state.gameStarted) return "active";
  return "pending";
}

function stateFromRow(row: {
  status: string;
  completed_at: number | null;
}, players: string[], playerIdentities: Record<string, string>): ChallengeOperatorState {
  return {
    gameStarted: row.status === "active" || row.status === "completed",
    gameEnded: row.status === "completed" || row.status === "expired",
    completedAt: row.completed_at ?? undefined,
    scores: [],
    players,
    playerIdentities,
  };
}

export class SqlArenaStorageAdapter implements ArenaStorageAdapter {
  /** Live ChallengeOperator instances are runtime-only. */
  private operators = new Map<string, ChallengeOperator>();

  constructor(private readonly db: Kysely<Database>) {}

  async clearRuntimeState(): Promise<void> {
    this.operators.clear();
    await this.db.deleteFrom("challenges").execute();
  }

  async listChallenges(): Promise<Challenge[]> {
    const rows = await this.db
      .selectFrom("challenges")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
    return Promise.all(rows.map((r) => this.hydrateChallenge(r)));
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const row = await this.db
      .selectFrom("challenges")
      .selectAll()
      .where("id", "=", challengeId)
      .executeTakeFirst();
    if (!row) return undefined;
    return this.hydrateChallenge(row);
  }

  async getChallengeFromInvite(invite: string): Promise<Challenge | undefined> {
    const inviteRow = await this.db
      .selectFrom("challenge_invites")
      .select("challenge_id")
      .where("invite", "=", invite)
      .executeTakeFirst();
    if (!inviteRow) return undefined;
    return this.getChallenge(inviteRow.challenge_id);
  }

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    const rows = await this.db
      .selectFrom("challenges")
      .innerJoin("challenge_invites", "challenge_invites.challenge_id", "challenges.id")
      .select("challenges.id")
      .where("challenge_invites.user_id", "=", userId)
      .groupBy("challenges.id")
      .orderBy("challenges.created_at", "desc")
      .execute();

    if (rows.length === 0) return [];

    const challenges = await Promise.all(rows.map((r) => this.getChallenge(r.id)));
    return challenges.filter((c): c is Challenge => c !== undefined);
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    const state = challenge.instance?.state;
    if (challenge.instance) {
      this.operators.set(challenge.id, challenge.instance);
    }

    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("challenges")
        .values({
          id: challenge.id,
          name: challenge.name,
          challenge_type: challenge.challengeType,
          created_at: challenge.createdAt,
          status: statusFromState(state),
          completed_at: state?.completedAt ?? null,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: challenge.name,
            challenge_type: challenge.challengeType,
            status: statusFromState(state),
            completed_at: state?.completedAt ?? null,
          })
        )
        .execute();

      await trx
        .deleteFrom("challenge_invites")
        .where("challenge_id", "=", challenge.id)
        .execute();

      if (challenge.invites.length > 0) {
        const playerIdentities = state?.playerIdentities ?? {};
        await trx
          .insertInto("challenge_invites")
          .values(
            challenge.invites.map((invite, playerIndex) => ({
              invite,
              challenge_id: challenge.id,
              player_index: playerIndex,
              user_id: playerIdentities[invite] ?? null,
            }))
          )
          .execute();
      }
    });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    this.operators.delete(challengeId);
    await this.db
      .deleteFrom("challenges")
      .where("id", "=", challengeId)
      .execute();
  }

  private async hydrateChallenge(row: {
    id: string;
    name: string;
    challenge_type: string;
    created_at: number;
    status: string;
    completed_at: number | null;
  }): Promise<Challenge> {
    const inviteRows = await this.db
      .selectFrom("challenge_invites")
      .selectAll()
      .where("challenge_id", "=", row.id)
      .orderBy("player_index", "asc")
      .execute();

    const invites = inviteRows.map((r) => r.invite);
    const playerIdentities: Record<string, string> = {};
    const players: string[] = [];
    for (const invite of inviteRows) {
      if (invite.user_id) {
        playerIdentities[invite.invite] = invite.user_id;
        players.push(invite.invite);
      }
    }

    const live = this.operators.get(row.id);
    if (live) {
      return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        challengeType: row.challenge_type,
        invites,
        instance: live,
      };
    }

    const state = stateFromRow(row, players, playerIdentities);
    const instance: ChallengeOperator = {
      state,
      async join() {
        throw new Error("Challenge runtime is unavailable after server restart");
      },
      async message() {
        throw new Error("Challenge runtime is unavailable after server restart");
      },
    };

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      challengeType: row.challenge_type,
      invites,
      instance,
    };
  }
}
