import { type ArenaEngine, defaultEngine } from "../engine";

export function chatSend(
  channel: string,
  from: string,
  content: string,
  to?: string | null,
  engine: ArenaEngine = defaultEngine
) {
  return engine.chatSend(channel, from, content, to);
}

export function chatSync(channel: string, from: string, index: number, engine: ArenaEngine = defaultEngine) {
  return engine.chatSync(channel, from, index);
}
