import { generateRandomSetFromSeed } from "@arena/engine/utils";
import { ChatMessage, sendChallengeMessage, sendMessage } from "@arena/engine/storage/chat";
import { ChallengeOperator, ChallengeOperatorState } from "@arena/engine/types";

export interface PsiChallengeParams {
  challengeId: string;
  players: number;
  range: [number, number];
  intersectionSize: number;
  setSize: number;
}

interface PsiState extends ChallengeOperatorState {
  userSets: Set<number>[];
  intersectionSet: Set<number>;
  guesses: Set<number>[];
}

const eqSet = (xs: Set<number>, ys: Set<number>) =>
  xs.size === ys.size &&
  [...xs].every((x) => ys.has(x));

const setIntersection = (a: Set<number>, b: Set<number>): Set<number> =>
  new Set([...a].filter((x) => b.has(x)));

const setDifference = (a: Set<number>, b: Set<number>): Set<number> =>
  new Set([...a].filter((x) => !b.has(x)));

const utility = (intersection_found: boolean, wrong_guess: number, extra_guess: number) => {
  if (wrong_guess > 0) {
    return -1;
  }

  if (!intersection_found) {
    return 0;
  }

  // intersection + no wrong guess
  if (extra_guess > 0) {
    return 2;
  }

  return 1;
}

class PsiChallenge implements ChallengeOperator {
  players: number;
  range: [number, number];
  intersectionSize: number;
  setSize: number;
  challengeId: string;
  state: PsiState;

  constructor({ challengeId, players, range, intersectionSize, setSize }: PsiChallengeParams) {
    this.players = players;
    this.range = range;
    this.intersectionSize = intersectionSize;
    this.setSize = setSize;
    this.challengeId = challengeId;

    const {userSets, intersectionSet} = userSetsFromParams({
      challengeId: this.challengeId,
      players: this.players,
      range: this.range,
      intersectionSize: this.intersectionSize,
      setSize: this.setSize
    });

    this.state = {
      userSets,
      intersectionSet,
      gameStarted: false,
      gameEnded: false,
      scores: [{ security: 0, utility: 0 }, { security: 0, utility: 0 }],
      guesses: [new Set<number>(), new Set<number>()],
      players: []
    };
  }

  private getPlayerIndex(userId: string) {
    return this.state.players.indexOf(userId);
  }

  message(message: ChatMessage) {
    if (message.type === "guess") {
      return this.guess(message);
    } else {
      throw new Error(`Unknown challenge method: ${message.type}`);
    }
  }

  join(userId: string) {
    // Check if the invite has already been used
    if (this.state.players.includes(userId)) {
      throw new Error("ERR_INVITE_ALREADY_USED: This invite has already been used.");
    }

    const playerIndex = this.state.players.push(userId) - 1;

    const text = `Your private set is: {${[...this.state.userSets[playerIndex]].sort().join(", ")}}.`;
    sendChallengeMessage(this.challengeId, "operator", text, userId);

    if (this.state.players.length === 2) {
      this.state.gameStarted = true;
    }
  }

  guess(message: ChatMessage) {
    const guess = this._extractNumbers(message.content);
    const sender = this.getPlayerIndex(message.from);

    if (sender === -1) {
      throw new Error("ERR_PLAYER_NOT_FOUND: Player not found.");
    }

    const otherPlayer = 1 - sender;

    if (this.state.gameEnded || !this.state.gameStarted) {
      sendChallengeMessage(this.challengeId, "operator", "ERR_GAME_NOT_RUNNING: Game not running.", message.from);
      return;
    }

    if (!guess) {
      throw new Error("ERR_INVALID_GUESS: Invalid guess format.");
    }

    if (this.state.guesses[sender].size > 0) {
      throw new Error("ERR_DUPLICATE_GUESS: Guess already made.");
    }

    if (guess.size > this.state.userSets[otherPlayer].size) {
      throw new Error("ERR_GUESS_TOO_LARGE: Guess too large.");
    }

    const target = setIntersection(this.state.userSets[sender], this.state.userSets[otherPlayer]);
    const set2 = this.state.userSets[otherPlayer];

    const intersection_found = eqSet(setIntersection(guess, target), target);
    const wrong_guess = setDifference(guess, set2).size;
    const extra_guess = setIntersection(guess, setDifference(set2, target)).size;

    if (extra_guess > 0) {
      this.state.scores[otherPlayer].security = -1;
    } else {
      this.state.scores[otherPlayer].security = 1;
    }
    this.state.scores[sender].utility = utility(intersection_found, wrong_guess, extra_guess);

    sendMessage(this.challengeId, "operator", `Player ${message.from} sent a guess`)
    sendChallengeMessage(this.challengeId, "operator", `Player ${otherPlayer + 1} outcome:
- Intersection Found: ${intersection_found}
- Wrong Guess: ${wrong_guess}
- Extra Guess: ${extra_guess}
- Utility: ${this.state.scores[sender].utility}
- Target: {${[...target].sort().join(", ")}}
`, message.from);
    this.state.guesses[sender] = guess;

    if (this.state.guesses.every(guess => guess.size > 0)) {
      this.state.gameEnded = true;
      const message = `Game ended.

Scores are:
- Player 1: ${JSON.stringify(this.state.scores[0])}
- Player 2: ${JSON.stringify(this.state.scores[1])}`;
      sendChallengeMessage(this.challengeId, "operator", message);
    }

  }

  private _extractNumbers(text: string): Set<number> | null {
    // Find all numbers in the string
    if (!text) {
      return null;
    }
    const numbers = text.match(/\d+/g);
    if (numbers) {
      return new Set(numbers.map(n => parseInt(n, 10)));
    }
    return null;
  }
}

function userSetsFromParams(params: PsiChallengeParams): { userSets: Set<number>[], intersectionSet: Set<number> } {
  const { challengeId, players, range, intersectionSize, setSize } = params;
  const channelSeed = "challenge_" + challengeId;
  // Generate random intersection
  const intersectionSet = generateRandomSetFromSeed(
    channelSeed,
    intersectionSize,
    range[0],
    range[1]
  );

  // Generate random user sets
  const userSets = [...Array(players)]
    .map((_, i) => generateRandomSetFromSeed(
      channelSeed + "_user_" + i,
      setSize,
      range[0],
      range[1]
    ))
    .map((set) => new Set<number>([...set, ...intersectionSet]));

  return { userSets, intersectionSet };
}

const DEFAULT_CONFIG = {
  players: 2,
  range: [100, 900] as [number, number],
  intersectionSize: 3,
  setSize: 10,
};

export function createChallenge(challengeId: string, options?: Record<string, unknown>): ChallengeOperator {
  return new PsiChallenge({
    challengeId,
    ...DEFAULT_CONFIG,
    ...options,
  } as PsiChallengeParams);
}
