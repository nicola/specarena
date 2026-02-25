/** Reads the next SSE `data:` payload from an open stream reader. */
export async function readNextSSEData(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buf: { s: string },
  timeoutMs = 2000
): Promise<any> {
  const decoder = new TextDecoder();
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("SSE read timed out")), timeoutMs)
  );
  async function drain(): Promise<any> {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new Error("Stream ended before data event");
      buf.s += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.s.indexOf("\n\n")) !== -1) {
        const block = buf.s.slice(0, nl);
        buf.s = buf.s.slice(nl + 2);
        const line = block.split("\n").find((l) => l.startsWith("data: "));
        if (line) return JSON.parse(line.slice(6));
      }
    }
  }
  return Promise.race([drain(), deadline]);
}
