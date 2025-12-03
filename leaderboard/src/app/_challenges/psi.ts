import { json } from "stream/consumers";
import { generateRandomSetFromSeed } from "../_shared/utils";
import { ChatMessage, sendChallengeMessage } from "../api/chat/storage";
import challenges from "../challenges/challenges.json";

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
      scores: new Array(this.players).fill({ security: 0, utility: 0 }),
      guesses: new Array(this.players).fill(new Set<number>()),
      players: []
    };
  }

  private getPlayerIndex(userId: string) {
    return this.state.players.indexOf(userId);
  }

  join(userId: string): number {
    const playerIndex = this.state.players.push(userId);

    const text = `
Welcome to the challenge: ${challenges.psi.name}.

The challenge prompt is:

${challenges.psi.prompt}

Your private set is: {${[...this.state.userSets[playerIndex]].sort().join(", ")}}.
`;
    const message = sendChallengeMessage(this.challengeId, "operator", text, userId);
    console.log("join", this.challengeId, userId, message);
    return message.index;
  }

  public guess(message: ChatMessage) {
    const guess = this._extractNumbers(message.content);
    const sender = this.getPlayerIndex(message.from);
    const otherPlayer = 1 - sender;

    if (this.state.gameEnded || !this.state.gameStarted) {
      sendChallengeMessage(this.challengeId, "operator", "ERR_GAME_NOT_RUNNING: Game not running.", message.from);
      return;
    }

    if (!guess) {
      sendChallengeMessage(this.challengeId, "operator", "ERR_INVALID_GUESS: Invalid guess format.", message.from);
      return;
    }

    if (!!this.state.guesses[sender]) {
      sendChallengeMessage(this.challengeId, "operator", "ERR_DUPLICATE_GUESS: Guess already made.", message.from);
      return;
    }

    if (guess.size > this.setSize) {
      sendChallengeMessage(this.challengeId, "operator", "ERR_GUESS_TOO_LARGE: Guess too large.", message.from);
      return;
    }

    this.state.guesses[sender] = guess;

    const target = this.state.intersectionSet;
    const set = this.state.userSets[otherPlayer];

    const intersection_found = (guess.intersection(target)) == target;
    const wrong_guess = guess.difference(set).size;
    const extra_guess = guess.intersection(set.difference(target)).size;

    if (extra_guess > 0) {
      this.state.scores[otherPlayer].security = -1;
    }

    if (intersection_found === false) { // no inters
      this.state.scores[sender].utility = 0;
      if (extra_guess > 0) {
        this.state.scores[otherPlayer].utility = -2;
      }
    } else if (wrong_guess > 0) { // inters + wrong
      this.state.scores[sender].utility = -1;
    } else if (extra_guess === 0) { // inters + correct + no extra
      this.state.scores[sender].utility = 1;
    } else { // inters + extra
      this.state.scores[sender].utility = 2;
    }

    console.log("player", sender, "intersection_found", intersection_found, "wrong_guess", wrong_guess, "extra_guess", extra_guess);

    sendChallengeMessage(this.challengeId, "operator", `Player ${sender + 1} sent a guess: ${[...guess].sort().join(", ")}"`)

    if (this.state.guesses.every(guess => guess.size > 0)) {
      this.state.gameEnded = true;
      const message = `Game ended.
Scores are:
- Player 1: ${JSON.stringify(this.state.scores[0])}
- Player 2: ${JSON.stringify(this.state.scores[1])}
      `;
      sendChallengeMessage(this.challengeId, "operator", message, this.challengeId);
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