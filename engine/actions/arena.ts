import { type ArenaEngine, defaultEngine } from "../engine";

export function challengeJoin(invite: string, engine: ArenaEngine = defaultEngine) {
  return engine.challengeJoin(invite);
}

export function challengeMessage(
  challengeId: string,
  from: string,
  messageType: string,
  content: string,
  engine: ArenaEngine = defaultEngine
) {
  return engine.challengeMessage(challengeId, from, messageType, content);
}

export function challengeSync(channel: string, from: string, index: number, engine: ArenaEngine = defaultEngine) {
  return engine.challengeSync(channel, from, index);
}
