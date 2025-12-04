import { generateRandomSetFromSeed } from "../_shared/utils";
import { ChatMessage, sendChallengeMessage } from "../api/chat/storage";

interface PsiChallengeParams {
  challengeId: string;
  players: number;
  range: [number, number];
  intersectionSize: number;
  setSize: number;
}

interface PsiState {
  userSets: Set<number>[];
  intersectionSet: Set<number>;
  gameStarted: boolean;
  gameEnded: boolean;
  scores: Score[];
  guesses: Set<number>[];
  players: string[];
}

export interface Score {
  security: number;
  utility: number;
}

const eqSet = (xs: Set<number>, ys: Set<number>) =>
  xs.size === ys.size &&
  [...xs].every((x) => ys.has(x));

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

export class PsiChallenge {
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
    const playerIndex = this.state.players.push(userId) - 1;

    const text = `Your private set is: {${[...this.state.userSets[playerIndex]].sort().join(", ")}}.`;
    const message = sendChallengeMessage(this.challengeId, "operator", text, userId);
    console.log("join", this.challengeId, userId, message);

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

    console.log("guesses", this.state.guesses, sender, guess);
    if (this.state.guesses[sender].size > 0) {
      throw new Error("ERR_DUPLICATE_GUESS: Guess already made.");
    }

    if (guess.size > this.state.userSets[otherPlayer].size) {
      throw new Error("ERR_GUESS_TOO_LARGE: Guess too large.");
    }

    const target = this.state.userSets[sender].intersection(this.state.userSets[otherPlayer]);
    const set2 = this.state.userSets[otherPlayer];

    console.log("Guess pass validation", guess, target, set2);
    console.log("userSets", this.state.userSets, otherPlayer);

    const intersection_found = eqSet(guess.intersection(target), target);
    const wrong_guess = guess.difference(set2).size;
    const extra_guess = guess.intersection(set2.difference(target)).size;

    if (extra_guess > 0) {
      this.state.scores[otherPlayer].security = -1;
    } else {
      this.state.scores[otherPlayer].security = 1;
    }
    this.state.scores[sender].utility = utility(intersection_found, wrong_guess, extra_guess);

    console.log("player", sender, "intersection_found", intersection_found, "wrong_guess", wrong_guess, "extra_guess", extra_guess, "target", target, "set2", set2);
    console.log("SCORES - intermediate", this.state.scores);

    sendChallengeMessage(this.challengeId, "operator", `Player ${sender + 1} sent a guess`)
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
      console.log("SCORES - final", this.state.scores);
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