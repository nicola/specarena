import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ArenaStorageAdapter, ChallengeQueryOptions, PaginatedResult } from "../types";
import type { Challenge, ChallengeOperatorState, ChallengeStatus, GameCategory, Score, Attribution } from "../../types";

type ChallengeRow = {
  id: string;
  name: string;
  challenge_type: string;
  created_at: Date;
  status: string;
  completed_at: Date | null;
  game_state: unknown;
  game_category: string;
};

export class SqlArenaStorageAdapter implements ArenaStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const row = await this.db
      .selectFrom("challenges")
      .selectAll()
      .where("id", "=", challengeId)
      .executeTakeFirst();

    if (!row) return undefined;
    const [challenge] = await this.rowsToChallenges([row]);
    return challenge;
  }

  async getChallengeFromInvite(invite: string): Promise<Challenge | undefined> {
    const inv = await this.db
      .selectFrom("challenge_invites")
      .select("challenge_id")
      .where("invite", "=", invite)
      .executeTakeFirst();

    if (!inv) return undefined;
    return this.getChallenge(inv.challenge_id);
  }

  async getChallengesByUserId(userId: string, options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    let baseQuery = this.db
      .selectFrom("challenges")
      .innerJoin("challenge_invites", "challenge_invites.challenge_id", "challenges.id")
      .where("challenge_invites.user_id", "=", userId);

    if (options?.status) {
      baseQuery = baseQuery.where("challenges.status", "=", options.status);
    }

    const [countResult, rows] = await Promise.all([
      baseQuery
        .select(({ fn }) => fn.count<number>("challenges.id").distinct().as("count"))
        .executeTakeFirstOrThrow(),
      (() => {
        let q = baseQuery
          .selectAll("challenges")
          .distinctOn("challenges.id")
          .orderBy("challenges.id");
        if (options?.limit) q = q.limit(options.limit);
        if (options?.offset) q = q.offset(options.offset);
        return q.execute();
      })(),
    ]);

    const challenges = await this.rowsToChallenges(rows);
    return {
      items: challenges.sort((a, b) => b.createdAt - a.createdAt),
      total: Number(countResult.count),
    };
  }

  async getChallengesByType(challengeType: string, options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    let baseQuery = this.db
      .selectFrom("challenges")
      .where("challenge_type", "=", challengeType);

    if (options?.status) {
      baseQuery = baseQuery.where("status", "=", options.status);
    }

    const [countResult, rows] = await Promise.all([
      baseQuery
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .executeTakeFirstOrThrow(),
      (() => {
        let q = baseQuery.selectAll().orderBy("created_at", "desc");
        if (options?.limit) q = q.limit(options.limit);
        if (options?.offset) q = q.offset(options.offset);
        return q.execute();
      })(),
    ]);

    return {
      items: await this.rowsToChallenges(rows),
      total: Number(countResult.count),
    };
  }

  async listChallenges(options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    let baseQuery = this.db.selectFrom("challenges");
    if (options?.status) {
      baseQuery = baseQuery.where("status", "=", options.status);
    }

    const [countResult, rows] = await Promise.all([
      baseQuery
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .executeTakeFirstOrThrow(),
      (() => {
        let q = baseQuery.selectAll().orderBy("created_at", "desc");
        if (options?.limit) q = q.limit(options.limit);
        if (options?.offset) q = q.offset(options.offset);
        return q.execute();
      })(),
    ]);

    return {
      items: await this.rowsToChallenges(rows),
      total: Number(countResult.count),
    };
  }

  async setChallenge(challenge: Challenge): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      const state = challenge.state;

      await tx
        .insertInto("challenges")
        .values({
          id: challenge.id,
          name: challenge.name,
          challenge_type: challenge.challengeType,
          created_at: new Date(challenge.createdAt),
          status: state.status,
          completed_at: state.completedAt ? new Date(state.completedAt) : null,
          game_state: JSON.stringify(challenge.gameState),
          game_category: challenge.gameCategory ?? "train",
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: challenge.name,
            challenge_type: challenge.challengeType,
            created_at: new Date(challenge.createdAt),
            status: state.status,
            completed_at: state.completedAt ? new Date(state.completedAt) : null,
            game_state: JSON.stringify(challenge.gameState),
            game_category: challenge.gameCategory ?? "train",
          }),
        )
        .execute();

      // Rebuild invites
      await tx
        .deleteFrom("challenge_invites")
        .where("challenge_id", "=", challenge.id)
        .execute();

      if (challenge.invites.length > 0) {
        const inviteRows = challenge.invites.map((invite) => {
          const playerIdx = state.players.indexOf(invite);
          const userId = state.playerIdentities[invite] ?? null;
          return {
            challenge_id: challenge.id,
            invite,
            user_id: userId,
            player_index: playerIdx >= 0 ? playerIdx : null,
          };
        });

        await tx.insertInto("challenge_invites").values(inviteRows).execute();
      }

      // Persist scores whenever players have scores (needed for mid-game round-trips)
      await tx
        .deleteFrom("game_scores")
        .where("challenge_id", "=", challenge.id)
        .execute();

      const defaultScore: Score = { security: 0, utility: 0 };
      const scoreRows = state.players.map((invite, i) => {
        const score = state.scores[i] ?? defaultScore;
        return {
          challenge_id: challenge.id,
          player_id: invite,
          security: score.security,
          utility: score.utility,
        };
      });

      if (scoreRows.length > 0) {
        await tx.insertInto("game_scores").values(scoreRows).execute();
      }

      // Persist attributions (always, for crash recovery)
      await tx
        .deleteFrom("scoring_attributions")
        .where("challenge_id", "=", challenge.id)
        .execute();

      if (state.attributions && state.attributions.length > 0) {
        const attrRows = state.attributions.map((a) => ({
          challenge_id: challenge.id,
          from_player_index: a.from,
          to_player_index: a.to,
          type: a.type,
        }));
        await tx.insertInto("scoring_attributions").values(attrRows).execute();
      }
    });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    // CASCADE handles challenge_invites, game_scores, scoring_attributions
    await this.db.deleteFrom("challenges").where("id", "=", challengeId).execute();
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("challenges").execute();
  }

  private async rowsToChallenges(rows: ChallengeRow[]): Promise<Challenge[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);

    // Batch-fetch all related data in 3 queries (instead of N×3)
    const [allInvites, allScores, allAttrs] = await Promise.all([
      this.db
        .selectFrom("challenge_invites")
        .selectAll()
        .where("challenge_id", "in", ids)
        .orderBy("challenge_id")
        .orderBy("player_index", "asc")
        .execute(),
      this.db
        .selectFrom("game_scores")
        .selectAll()
        .where("challenge_id", "in", ids)
        .execute(),
      this.db
        .selectFrom("scoring_attributions")
        .select(["challenge_id", "from_player_index", "to_player_index", "type"])
        .where("challenge_id", "in", ids)
        .execute(),
    ]);

    // Group by challenge_id
    const invitesByChallenge = new Map<string, typeof allInvites>();
    for (const inv of allInvites) {
      let list = invitesByChallenge.get(inv.challenge_id);
      if (!list) { list = []; invitesByChallenge.set(inv.challenge_id, list); }
      list.push(inv);
    }

    const scoresByChallenge = new Map<string, typeof allScores>();
    for (const sr of allScores) {
      let list = scoresByChallenge.get(sr.challenge_id);
      if (!list) { list = []; scoresByChallenge.set(sr.challenge_id, list); }
      list.push(sr);
    }

    const attrsByChallenge = new Map<string, typeof allAttrs>();
    for (const a of allAttrs) {
      let list = attrsByChallenge.get(a.challenge_id);
      if (!list) { list = []; attrsByChallenge.set(a.challenge_id, list); }
      list.push(a);
    }

    return rows.map((row) => this.assembleChallenge(
      row,
      invitesByChallenge.get(row.id) ?? [],
      scoresByChallenge.get(row.id) ?? [],
      attrsByChallenge.get(row.id) ?? [],
    ));
  }

  private assembleChallenge(
    row: ChallengeRow,
    invites: { invite: string; player_index: number | null; user_id: string | null }[],
    scoreRows: { player_id: string; security: number; utility: number }[],
    attrRows: { from_player_index: number; to_player_index: number; type: string }[],
  ): Challenge {
    const players: string[] = [];
    const playerIdentities: Record<string, string> = {};
    const inviteList: string[] = [];

    for (const inv of invites) {
      inviteList.push(inv.invite);
      if (inv.player_index !== null) {
        players[inv.player_index] = inv.invite;
      }
      if (inv.user_id) {
        playerIdentities[inv.invite] = inv.user_id;
      }
    }

    const playerCount = inviteList.length;
    const scores: Score[] = Array.from({ length: playerCount }, () => ({ security: 0, utility: 0 }));
    for (const sr of scoreRows) {
      const idx = players.indexOf(sr.player_id);
      if (idx >= 0) {
        scores[idx] = { security: sr.security, utility: sr.utility };
      }
    }

    const attributions: Attribution[] | undefined =
      attrRows.length > 0
        ? attrRows.map((a) => ({ from: a.from_player_index, to: a.to_player_index, type: a.type }))
        : undefined;

    const state: ChallengeOperatorState = {
      status: row.status as ChallengeStatus,
      completedAt: row.completed_at ? row.completed_at.getTime() : undefined,
      scores,
      players,
      playerIdentities,
      attributions,
    };

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at.getTime(),
      challengeType: row.challenge_type,
      invites: inviteList,
      state,
      gameState: row.game_state as Record<string, unknown>,
      gameCategory: row.game_category as GameCategory,
    };
  }
}
