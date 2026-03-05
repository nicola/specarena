import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ArenaStorageAdapter } from "../InMemoryArenaStorageAdapter";
import type {
  Challenge,
  ChallengeOperator,
  ChallengeOperatorState,
} from "../../types";

export class SqlArenaStorageAdapter implements ArenaStorageAdapter {
  /** Live ChallengeOperator instances — not serializable. */
  private operators = new Map<string, ChallengeOperator>();

  constructor(private readonly db: Kysely<Database>) {}

  async clearRuntimeState(): Promise<void> {
    this.operators.clear();
    // CASCADE deletes invites, scores, attributions
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

  async getChallengeFromInvite(
    invite: string
  ): Promise<Challenge | undefined> {
    const inviteRow = await this.db
      .selectFrom("challenge_invites")
      .select("challenge_id")
      .where("invite", "=", invite)
      .executeTakeFirst();
    if (!inviteRow) return undefined;
    return this.getChallenge(inviteRow.challenge_id);
  }

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    const inviteRows = await this.db
      .selectFrom("challenge_invites")
      .select("challenge_id")
      .where("user_id", "=", userId)
      .execute();

    if (inviteRows.length === 0) return [];

    const ids = [...new Set(inviteRows.map((r) => r.challenge_id))];
    const rows = await this.db
      .selectFrom("challenges")
      .selectAll()
      .where("id", "in", ids)
      .orderBy("created_at", "desc")
      .execute();

    return Promise.all(rows.map((r) => this.hydrateChallenge(r)));
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    const state = challenge.instance?.state;

    // Store the live operator (in-memory, not part of DB transaction)
    if (challenge.instance) {
      this.operators.set(challenge.id, challenge.instance);
    }

    // All SQL writes in a single transaction for atomicity
    await this.db.transaction().execute(async (trx) => {
      // Upsert challenge row
      await trx
        .insertInto("challenges")
        .values({
          id: challenge.id,
          name: challenge.name,
          challenge_type: challenge.challengeType,
          created_at: challenge.createdAt,
          game_started: state?.gameStarted ? 1 : 0,
          game_ended: state?.gameEnded ? 1 : 0,
          completed_at: state?.completedAt ?? null,
          game_state: null,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: challenge.name,
            challenge_type: challenge.challengeType,
            game_started: state?.gameStarted ? 1 : 0,
            game_ended: state?.gameEnded ? 1 : 0,
            completed_at: state?.completedAt ?? null,
          })
        )
        .execute();

      // Sync invites: delete old, insert current
      await trx
        .deleteFrom("challenge_invites")
        .where("challenge_id", "=", challenge.id)
        .execute();

      if (challenge.invites.length > 0) {
        const playerIdentities = state?.playerIdentities ?? {};
        const inviteRows = challenge.invites.map((invite, idx) => ({
          invite,
          challenge_id: challenge.id,
          player_index: idx,
          user_id: playerIdentities[invite] ?? null,
        }));
        await trx
          .insertInto("challenge_invites")
          .values(inviteRows)
          .execute();
      }

      // Sync scores
      await trx
        .deleteFrom("challenge_scores")
        .where("challenge_id", "=", challenge.id)
        .execute();

      if (state?.scores && state.scores.length > 0) {
        const scoreRows = state.scores.map((score, idx) => ({
          challenge_id: challenge.id,
          player_index: idx,
          security: score.security,
          utility: score.utility,
        }));
        await trx
          .insertInto("challenge_scores")
          .values(scoreRows)
          .execute();
      }

      // Sync attributions
      await trx
        .deleteFrom("challenge_attributions")
        .where("challenge_id", "=", challenge.id)
        .execute();

      if (state?.attributions && state.attributions.length > 0) {
        const attrRows = state.attributions.map((a) => ({
          challenge_id: challenge.id,
          from_idx: a.from,
          to_idx: a.to,
          type: a.type,
        }));
        await trx
          .insertInto("challenge_attributions")
          .values(attrRows)
          .execute();
      }
    });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    this.operators.delete(challengeId);
    // CASCADE handles invites, scores, attributions
    await this.db
      .deleteFrom("challenges")
      .where("id", "=", challengeId)
      .execute();
  }

  /**
   * Hydrate a Challenge from a DB row + related tables.
   * Attaches live operator from Map, or creates a read-only stub for completed games.
   */
  private async hydrateChallenge(row: {
    id: string;
    name: string;
    challenge_type: string;
    created_at: number;
    game_started: number;
    game_ended: number;
    completed_at: number | null;
    game_state: string | null;
  }): Promise<Challenge> {
    const [inviteRows, scoreRows, attrRows] = await Promise.all([
      this.db
        .selectFrom("challenge_invites")
        .selectAll()
        .where("challenge_id", "=", row.id)
        .orderBy("player_index", "asc")
        .execute(),
      this.db
        .selectFrom("challenge_scores")
        .selectAll()
        .where("challenge_id", "=", row.id)
        .orderBy("player_index", "asc")
        .execute(),
      this.db
        .selectFrom("challenge_attributions")
        .selectAll()
        .where("challenge_id", "=", row.id)
        .execute(),
    ]);

    const invites = inviteRows.map((r) => r.invite);
    const players = inviteRows
      .filter((r) => r.user_id != null)
      .map((r) => r.invite);
    const playerIdentities: Record<string, string> = {};
    for (const inv of inviteRows) {
      if (inv.user_id != null) {
        playerIdentities[inv.invite] = inv.user_id;
      }
    }
    const scores = scoreRows.map((r) => ({
      security: r.security,
      utility: r.utility,
    }));
    const attributions = attrRows.map((r) => ({
      from: r.from_idx,
      to: r.to_idx,
      type: r.type,
    }));

    const state: ChallengeOperatorState = {
      gameStarted: row.game_started === 1,
      gameEnded: row.game_ended === 1,
      completedAt: row.completed_at ?? undefined,
      scores,
      players,
      playerIdentities,
      attributions: attributions.length > 0 ? attributions : undefined,
    };

    // Try live operator first
    let instance = this.operators.get(row.id);
    if (instance) {
      // Keep operator's live state in sync — it's the source of truth for active games
      return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        challengeType: row.challenge_type,
        invites,
        instance,
      };
    }

    // Read-only stub for completed/historical games
    instance = {
      state,
      async join() {
        throw new Error("Cannot join a completed challenge");
      },
      async message() {
        throw new Error("Cannot message a completed challenge");
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
