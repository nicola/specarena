/**
 * Ultimatum Game Challenge
 * ========================
 *
 * A multi-agent negotiation game where N agents must split a fixed resource
 * (default: $100). Each agent has a **private reservation value** — the
 * minimum share they are willing to accept. If no agreement is reached within
 * a maximum number of rounds, everyone gets nothing.
 *
 * Key design decisions (commented inline):
 *
 * 1. We extend BaseChallenge<UltimatumGameState> just like PSI does.
 *    BaseChallenge gives us player join lifecycle, handler dispatch, messaging
 *    helpers, and endGame().
 *
 * 2. Unlike PSI (which has a single "guess" handler), we register five
 *    handlers: submit_offer, accept, reject, pass, message_only.
 *
 * 3. Turn order is enforced — only the player whose turn it is may act.
 *    `message_only` is the exception: it doesn't consume a turn, so any
 *    player can send messages at any time.
 *
 * 4. Scoring uses only the `utility` dimension. Security is always 0 because
 *    there's no "attack" dimension in negotiation — just payoffs.
 */

import Prando from "prando";
import { derivePrivateSeed } from "@arena/engine/utils";
import {
  ChallengeFactoryContext,
  ChallengeOperatorError,
  ChatMessage,
  ChallengeMessaging,
  ChallengeOperator,
} from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configurable parameters passed via api/config.json options */
export interface UltimatumParams {
  challengeId: string;
  players: number;
  total: number;          // The fixed pot to be split (default 100)
  maxRounds: number;      // Maximum negotiation rounds before deadlock
  reservationMax: number; // Upper bound for reservation value sampling
  turnOrder: "round_robin" | "random"; // How turn order is decided

  // Optional: supply explicit reservation values (useful for testing).
  // If omitted, values are drawn from U[0, reservationMax] deterministically.
  reservationValues?: number[];
}

/** A single entry in the action history log */
interface ActionEntry {
  round: number;
  player: number;        // Player index (0-based)
  action: string;        // "submit_offer" | "accept" | "reject" | "pass"
  details?: unknown;     // Action-specific payload (e.g. the offer object)
}

/**
 * The game state tracked by the challenge operator.
 *
 * This is the TGameState generic parameter to BaseChallenge. It holds all
 * the mutable negotiation state that lives alongside the standard
 * ChallengeOperatorState (scores, players, gameStarted, etc.).
 */
interface UltimatumGameState {
  total: number;
  maxRounds: number;

  // --- Private information ---
  // Each player's secret minimum acceptable share. Index = player index.
  reservationValues: number[];

  // --- Offer state ---
  // The split currently on the table, or null if no offer is pending.
  // Maps player invite (string) → share (number).
  currentOffer: Record<string, number> | null;
  // Player index of whoever proposed the current offer, or null.
  lastOfferBy: number | null;
  // Set of player indices who have accepted the current offer.
  // The proposer is implicitly "accepted" and is excluded from this set.
  acceptances: Set<number>;

  // --- Turn tracking ---
  round: number;          // Current round (1-indexed; game ends if > maxRounds)
  turnOrder: number[];    // Ordered list of player indices for this round
  turnIndex: number;      // Position within turnOrder for the current turn
  turnOrderPolicy: "round_robin" | "random";

  // --- History ---
  actionHistory: ActionEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate deterministic reservation values for each player.
 *
 * We use derivePrivateSeed (HMAC-SHA256 keyed by a server secret) so that
 * reservation values cannot be predicted from the public challengeId.
 * Each player gets their own sub-seed so values are independent.
 */
function generateReservationValues(
  challengeId: string,
  playerCount: number,
  reservationMax: number,
): number[] {
  const values: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    // Derive a unique seed for each player's reservation value
    const seed = derivePrivateSeed(`ultimatum:${challengeId}:reservation:${i}`);
    const rng = new Prando(seed);
    // Draw from U[0, reservationMax] as an integer
    values.push(rng.nextInt(0, reservationMax));
  }
  return values;
}

/**
 * Build the turn order for a round.
 *
 * - round_robin: players act in order 0, 1, 2, ... (same every round)
 * - random: players act in a deterministic-random order (seeded per round)
 */
function buildTurnOrder(
  policy: "round_robin" | "random",
  playerCount: number,
  challengeId: string,
  round: number,
): number[] {
  const order = Array.from({ length: playerCount }, (_, i) => i);

  if (policy === "random") {
    // Deterministic shuffle seeded by challenge + round so it's reproducible
    const seed = derivePrivateSeed(`ultimatum:${challengeId}:turn:${round}`);
    const rng = new Prando(seed);
    // Fisher-Yates shuffle
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  return order;
}

/**
 * Format the visible game state for a specific player.
 *
 * Each player sees everything except other players' reservation values.
 * We serialize this as a human-readable string that an LLM can parse.
 */
function formatStateForPlayer(
  gs: UltimatumGameState,
  players: string[],
  playerIndex: number,
): string {
  const lines: string[] = [];
  lines.push(`Round: ${gs.round} / ${gs.maxRounds}`);
  lines.push(`Total to split: ${gs.total}`);
  lines.push(`Agents: ${players.map((p, i) => `Player ${i + 1} (${p})`).join(", ")}`);
  lines.push(`Your reservation value: ${gs.reservationValues[playerIndex]}`);

  if (gs.currentOffer) {
    lines.push(`Current offer by Player ${gs.lastOfferBy! + 1}: ${JSON.stringify(gs.currentOffer)}`);
    const accepted = [...gs.acceptances].map((i) => `Player ${i + 1}`);
    lines.push(`Acceptances: ${accepted.length > 0 ? accepted.join(", ") : "none"}`);
  } else {
    lines.push("No offer on the table.");
  }

  // Show whose turn it is
  const currentPlayer = gs.turnOrder[gs.turnIndex];
  lines.push(`Current turn: Player ${currentPlayer + 1} (${players[currentPlayer]})`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Challenge implementation
// ---------------------------------------------------------------------------

class UltimatumChallenge extends BaseChallenge<UltimatumGameState> {
  constructor(params: UltimatumParams, messaging?: ChallengeMessaging) {
    // Determine reservation values: either supplied explicitly (for tests)
    // or generated deterministically from the challenge seed.
    const reservationValues =
      params.reservationValues ??
      generateReservationValues(params.challengeId, params.players, params.reservationMax);

    // Build initial game state.
    // Round starts at 1, turnIndex at 0. The turn order for round 1 is
    // computed once the game starts (in onGameStart) because we need
    // playerCount to be finalized.
    super(
      params.challengeId,
      params.players,
      {
        total: params.total,
        maxRounds: params.maxRounds,
        reservationValues,
        currentOffer: null,
        lastOfferBy: null,
        acceptances: new Set(),
        round: 1,
        turnOrder: [],   // Populated in onGameStart
        turnIndex: 0,
        turnOrderPolicy: params.turnOrder,
        actionHistory: [],
      },
      messaging,
    );

    // --- Register action handlers ---
    // Each handler corresponds to one of the methods listed in challenge.json.
    // BaseChallenge.message() routes incoming messages to the right handler
    // based on message.type.

    this.handle("submit_offer", (msg, idx) => this.onSubmitOffer(msg, idx));
    this.handle("accept", (msg, idx) => this.onAccept(msg, idx));
    this.handle("reject", (msg, idx) => this.onReject(msg, idx));
    this.handle("pass", (msg, idx) => this.onPass(msg, idx));

    // message_only is special: it sends a chat message without consuming
    // the player's turn. We still register it as a handler so the engine
    // routes it here rather than rejecting it as an unknown method.
    this.handle("message_only", (msg, _idx) => this.onMessageOnly(msg));
  }

  // -----------------------------------------------------------------------
  // Lifecycle hooks
  // -----------------------------------------------------------------------

  /**
   * Called when each player joins.
   *
   * We privately tell them their reservation value — this is the key piece
   * of private information in the game.
   */
  protected async onPlayerJoin(playerId: string, playerIndex: number): Promise<void> {
    await this.send(
      `Welcome to the Ultimatum Game!\n` +
      `Your private reservation value is: ${this.gameState.reservationValues[playerIndex]}.\n` +
      `This is the minimum share you should accept. This value is secret — only you can see it.`,
      playerId,
    );
  }

  /**
   * Called once all players have joined (BaseChallenge sets gameStarted=true).
   *
   * We compute the initial turn order and broadcast the game state so every
   * player knows the rules and whose turn it is.
   */
  protected async onGameStart(): Promise<void> {
    // Build turn order for round 1
    this.gameState.turnOrder = buildTurnOrder(
      this.gameState.turnOrderPolicy,
      this.playerCount,
      this.challengeId,
      this.gameState.round,
    );

    // Broadcast the initial state to each player (each sees only their own
    // reservation value).
    for (let i = 0; i < this.state.players.length; i++) {
      const stateStr = formatStateForPlayer(
        this.gameState,
        this.state.players,
        i,
      );
      await this.send(
        `Game started!\n\n${stateStr}`,
        this.state.players[i],
      );
    }
  }

  // -----------------------------------------------------------------------
  // Action handlers
  // -----------------------------------------------------------------------

  /**
   * submit_offer: Propose a split of the total.
   *
   * The message content must be a JSON object mapping player invite IDs to
   * shares (numbers). The shares must sum exactly to `total`.
   *
   * Submitting a new offer clears any previous acceptances — agents must
   * re-accept the new proposal.
   */
  private async onSubmitOffer(message: ChatMessage, senderIndex: number): Promise<void> {
    this.assertTurn(senderIndex);

    // Parse the offer from the message content.
    // We expect JSON like: {"inv_abc": 60, "inv_xyz": 40}
    const offer = this.parseOffer(message.content);

    // Validate: every player must be assigned a share
    for (const player of this.state.players) {
      if (offer[player] === undefined) {
        throw new ChallengeOperatorError(
          "INCOMPLETE_OFFER",
          `Offer must include a share for every player. Missing: ${player}`,
        );
      }
    }

    // Validate: shares must be non-negative
    for (const [player, share] of Object.entries(offer)) {
      if (share < 0) {
        throw new ChallengeOperatorError(
          "NEGATIVE_SHARE",
          `Share for ${player} is negative (${share}). All shares must be >= 0.`,
        );
      }
    }

    // Validate: shares must sum to exactly `total`
    const sum = Object.values(offer).reduce((a, b) => a + b, 0);
    if (sum !== this.gameState.total) {
      throw new ChallengeOperatorError(
        "INVALID_OFFER_SUM",
        `Offer shares sum to ${sum}, but must equal ${this.gameState.total}.`,
      );
    }

    // Accept the offer: clear old state, record the new proposal
    this.gameState.currentOffer = offer;
    this.gameState.lastOfferBy = senderIndex;
    this.gameState.acceptances = new Set();

    // Log the action
    this.gameState.actionHistory.push({
      round: this.gameState.round,
      player: senderIndex,
      action: "submit_offer",
      details: offer,
    });

    await this.broadcast(
      `Player ${senderIndex + 1} proposed a split: ${JSON.stringify(offer)}`,
    );

    this.advanceTurn();
    await this.broadcastTurnInfo();
  }

  /**
   * accept: Accept the current offer on the table.
   *
   * Only non-proposers can accept. If all non-proposers accept, the deal is
   * done and the game ends with the agreed split.
   */
  private async onAccept(message: ChatMessage, senderIndex: number): Promise<void> {
    this.assertTurn(senderIndex);

    // Can't accept if there's nothing on the table
    if (!this.gameState.currentOffer) {
      throw new ChallengeOperatorError(
        "NO_OFFER",
        "There is no offer on the table to accept.",
      );
    }

    // The proposer can't accept their own offer
    if (senderIndex === this.gameState.lastOfferBy) {
      throw new ChallengeOperatorError(
        "PROPOSER_CANNOT_ACCEPT",
        "You proposed this offer — you can't accept it yourself.",
      );
    }

    // Record the acceptance
    this.gameState.acceptances.add(senderIndex);

    this.gameState.actionHistory.push({
      round: this.gameState.round,
      player: senderIndex,
      action: "accept",
    });

    await this.broadcast(
      `Player ${senderIndex + 1} accepted the offer.`,
    );

    // Check for unanimous consent: every player except the proposer must
    // have accepted. The proposer implicitly agrees with their own offer.
    const nonProposers = this.state.players
      .map((_, i) => i)
      .filter((i) => i !== this.gameState.lastOfferBy);

    const allAccepted = nonProposers.every((i) => this.gameState.acceptances.has(i));

    if (allAccepted) {
      // Agreement reached! Calculate payoffs and end the game.
      await this.resolveAgreement();
    } else {
      this.advanceTurn();
      await this.broadcastTurnInfo();
    }
  }

  /**
   * reject: Reject the current offer.
   *
   * This clears the offer and all pending acceptances. The negotiation
   * continues — someone else (or the same player) must propose a new offer.
   */
  private async onReject(message: ChatMessage, senderIndex: number): Promise<void> {
    this.assertTurn(senderIndex);

    if (!this.gameState.currentOffer) {
      throw new ChallengeOperatorError(
        "NO_OFFER",
        "There is no offer on the table to reject.",
      );
    }

    // Clear the offer state
    this.gameState.currentOffer = null;
    this.gameState.lastOfferBy = null;
    this.gameState.acceptances = new Set();

    this.gameState.actionHistory.push({
      round: this.gameState.round,
      player: senderIndex,
      action: "reject",
    });

    await this.broadcast(
      `Player ${senderIndex + 1} rejected the offer. The table is cleared.`,
    );

    this.advanceTurn();
    await this.broadcastTurnInfo();
  }

  /**
   * pass: Skip your turn without doing anything.
   *
   * This is useful when you want to let other players act, or when you're
   * waiting for a better offer.
   */
  private async onPass(message: ChatMessage, senderIndex: number): Promise<void> {
    this.assertTurn(senderIndex);

    this.gameState.actionHistory.push({
      round: this.gameState.round,
      player: senderIndex,
      action: "pass",
    });

    await this.broadcast(`Player ${senderIndex + 1} passed.`);

    this.advanceTurn();
    await this.broadcastTurnInfo();
  }

  /**
   * message_only: Send a message without taking a game action.
   *
   * This is the only action that does NOT consume the player's turn. Any
   * player can send messages at any time (not just the active player).
   * The message content is broadcast via the chat system by the engine
   * itself (on the public chat channel), so we don't need to do anything
   * special here — we just acknowledge receipt.
   *
   * We intentionally do NOT call assertTurn() or advanceTurn().
   */
  private async onMessageOnly(_message: ChatMessage): Promise<void> {
    // No-op: the engine already delivered the message on the chat channel.
    // We simply don't advance the turn.
  }

  // -----------------------------------------------------------------------
  // Turn management
  // -----------------------------------------------------------------------

  /**
   * Verify that it's the given player's turn. Throws if not.
   *
   * We enforce strict turn order for all game actions. This prevents a
   * fast agent from spamming actions while a slow one is still thinking.
   */
  private assertTurn(senderIndex: number): void {
    const expectedPlayer = this.gameState.turnOrder[this.gameState.turnIndex];
    if (senderIndex !== expectedPlayer) {
      throw new ChallengeOperatorError(
        "NOT_YOUR_TURN",
        `It is Player ${expectedPlayer + 1}'s turn, not yours.`,
      );
    }
  }

  /**
   * Advance to the next player's turn.
   *
   * If we've gone through all players in the current round, start a new
   * round. If we've exceeded maxRounds, trigger deadlock.
   */
  private advanceTurn(): void {
    this.gameState.turnIndex++;

    // Check if we've exhausted all turns in this round
    if (this.gameState.turnIndex >= this.gameState.turnOrder.length) {
      // Start a new round
      this.gameState.round++;
      this.gameState.turnIndex = 0;

      // Recompute turn order (matters for "random" policy; no-op for
      // round_robin since the order is always 0,1,...,N-1)
      this.gameState.turnOrder = buildTurnOrder(
        this.gameState.turnOrderPolicy,
        this.playerCount,
        this.challengeId,
        this.gameState.round,
      );
    }
  }

  /**
   * Broadcast whose turn it is next — unless the game just ended.
   *
   * Also checks for deadlock (exceeded maxRounds).
   */
  private async broadcastTurnInfo(): Promise<void> {
    // Check deadlock: if the new round exceeds maxRounds, game over
    if (this.gameState.round > this.gameState.maxRounds) {
      await this.resolveDeadlock();
      return;
    }

    const nextPlayer = this.gameState.turnOrder[this.gameState.turnIndex];
    await this.broadcast(
      `It is now Player ${nextPlayer + 1}'s turn (${this.state.players[nextPlayer]}).`,
    );
  }

  // -----------------------------------------------------------------------
  // Game resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve the game when all non-proposers accept an offer.
   *
   * Payoff for each player: utility = share - reservation_value
   *
   * This means a player who gets less than their reservation value ends up
   * with negative utility (they "lost" by accepting a bad deal). A player
   * who gets exactly their reservation value breaks even (utility = 0).
   * A player who gets more than their reservation value profits.
   *
   * Security is always 0 — there's no "breach" concept in negotiation.
   */
  private async resolveAgreement(): Promise<void> {
    const offer = this.gameState.currentOffer!;

    for (let i = 0; i < this.state.players.length; i++) {
      const share = offer[this.state.players[i]] ?? 0;
      const reservation = this.gameState.reservationValues[i];
      this.state.scores[i].utility = share - reservation;
      // Security stays at 0 (initialized by BaseChallenge)
    }

    await this.broadcast(
      `Agreement reached! Final split: ${JSON.stringify(offer)}`,
    );
    await this.endGame();
  }

  /**
   * Resolve the game when maxRounds is exceeded with no agreement.
   *
   * Everyone gets utility = 0. This represents the "lose-lose" outcome
   * of failed negotiation — even though agents may have had positive
   * reservation values, they walked away with nothing.
   */
  private async resolveDeadlock(): Promise<void> {
    // All scores stay at 0 (already initialized by BaseChallenge)
    await this.broadcast(
      `Deadlock! Maximum rounds (${this.gameState.maxRounds}) reached with no agreement. Everyone gets nothing.`,
    );
    await this.endGame();
  }

  // -----------------------------------------------------------------------
  // Parsing
  // -----------------------------------------------------------------------

  /**
   * Parse an offer from message content.
   *
   * Accepts JSON like: {"inv_abc": 60, "inv_xyz": 40}
   * Also handles the case where agents wrap it in markdown code fences.
   */
  private parseOffer(content: string): Record<string, number> {
    // Strip markdown code fences if present (LLMs love to wrap JSON in ```)
    const stripped = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      const parsed = JSON.parse(stripped);

      // Validate it's a flat object with numeric values
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }

      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "number") {
          throw new Error(`value for "${key}" is not a number`);
        }
        result[key] = value;
      }

      return result;
    } catch {
      throw new ChallengeOperatorError(
        "INVALID_OFFER_FORMAT",
        `Could not parse offer. Send a JSON object mapping player IDs to shares, e.g.: {"${this.state.players[0]}": 60, "${this.state.players[1]}": 40}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Default configuration & factory
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  players: 2,
  total: 100,
  maxRounds: 10,
  reservationMax: 30,
  turnOrder: "round_robin" as const,
};

/**
 * Factory function — the only export the engine needs.
 *
 * This follows the same pattern as PSI: merge DEFAULT_CONFIG with any
 * options from api/config.json, then instantiate the challenge.
 */
export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext,
): ChallengeOperator {
  return new UltimatumChallenge(
    {
      challengeId,
      ...DEFAULT_CONFIG,
      ...options,
    } as UltimatumParams,
    context?.messaging,
  );
}
