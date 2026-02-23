function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Set) {
    return { __type: "Set", values: [...value] };
  }
  if (value instanceof Map) {
    return { __type: "Map", entries: [...value.entries()] };
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && "__type" in value) {
    const tagged = value as { __type: string };
    if (tagged.__type === "Set" && "values" in tagged) {
      return new Set((tagged as { values: unknown[] }).values);
    }
    if (tagged.__type === "Map" && "entries" in tagged) {
      return new Map((tagged as { entries: [unknown, unknown][] }).entries);
    }
  }
  return value;
}

export function serializeState(state: unknown): string {
  return JSON.stringify(state, replacer);
}

export function deserializeState(json: string): unknown {
  return JSON.parse(json, reviver);
}
