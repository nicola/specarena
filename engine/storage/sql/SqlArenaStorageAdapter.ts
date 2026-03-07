import type { Kysely } from "kysely";
import type { Database } from "./schema";
import type { ArenaStorageAdapter } from "../types";
import type { Challenge, ChallengeOperatorState, Score, Attribution } from "../../types";

export class SqlArenaStorageAdapter implements ArenaStorageAdapter {
  constructor(private readonly db: Kysely<Database>) {}

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const row = await this.db
      .selectFrom("challenges")
      .selectAll()
      .where("id", "=", challengeId)
      .executeTakeFirst();

    if (!row) return undefined;
    return this.rowToChallenge(row);
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

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    const rows = await this.db
      .selectFrom("challenges")
      .innerJoin("challenge_invites", "challenge_invites.challenge_id", "challenges.id")
      .where("challenge_invites.user_id", "=", userId)
      .selectAll("challenges")
      .distinctOn("challenges.id")
      .orderBy("challenges.id")
      .execute();

    const challenges = await Promise.all(rows.map((r) => this.rowToChallenge(r)));
    return challenges.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getChallengesByType(challengeType: string): Promise<Challenge[]> {
    const rows = await this.db
      .selectFrom("challenges")
      .selectAll()
      .where("challenge_type", "=", challengeType)
      .orderBy("created_at", "desc")
      .execute();
    return Promise.all(rows.map((r) => this.rowToChallenge(r)));
  }

  async listChallenges(): Promise<Challenge[]> {
    const rows = await this.db.selectFrom("challenges").selectAll().execute();
    return Promise.all(rows.map((r) => this.rowToChallenge(r)));
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
          game_started: state.gameStarted,
          game_ended: state.gameEnded,
          completed_at: state.completedAt ? new Date(state.completedAt) : null,
          scores: JSON.stringify(state.scores),
          attributions: state.attributions ? JSON.stringify(state.attributions) : null,
          game_state: JSON.stringify(challenge.gameState),
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: challenge.name,
            challenge_type: challenge.challengeType,
            game_started: state.gameStarted,
            game_ended: state.gameEnded,
            completed_at: state.completedAt ? new Date(state.completedAt) : null,
            scores: JSON.stringify(state.scores),
            attributions: state.attributions ? JSON.stringify(state.attributions) : null,
            game_state: JSON.stringify(challenge.gameState),
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
    });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    // CASCADE handles challenge_invites, game_scores, scoring_attributions
    await this.db.deleteFrom("challenges").where("id", "=", challengeId).execute();
  }

  async clearRuntimeState(): Promise<void> {
    await this.db.deleteFrom("challenges").execute();
  }

  private async rowToChallenge(row: {
    id: string;
    name: string;
    challenge_type: string;
    created_at: Date;
    game_started: boolean;
    game_ended: boolean;
    completed_at: Date | null;
    scores: unknown;
    attributions: unknown | null;
    game_state: unknown;
  }): Promise<Challenge> {
    const invites = await this.db
      .selectFrom("challenge_invites")
      .selectAll()
      .where("challenge_id", "=", row.id)
      .orderBy("player_index", "asc")
      .execute();

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

    const state: ChallengeOperatorState = {
      gameStarted: row.game_started,
      gameEnded: row.game_ended,
      completedAt: row.completed_at ? row.completed_at.getTime() : undefined,
      scores: (row.scores ?? []) as Score[],
      players,
      playerIdentities,
      attributions: (row.attributions ?? undefined) as Attribution[] | undefined,
    };

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at.getTime(),
      challengeType: row.challenge_type,
      invites: inviteList,
      state,
      gameState: row.game_state as Record<string, unknown>,
    };
  }
}
