import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createChallenge, parseOptions } from "./index";

describe("PSI options schema", () => {
  it("applies defaults when options are omitted", () => {
    const opts = parseOptions();
    assert.equal(opts.players, 2);
    assert.deepEqual(opts.range, [100, 900]);
    assert.equal(opts.intersectionSize, 3);
    assert.equal(opts.setSize, 10);
  });

  it("rejects invalid set/intersection relationship", () => {
    assert.throws(
      () => parseOptions({ intersectionSize: 5, setSize: 3 }),
      /intersectionSize must be less than or equal to setSize/,
    );
  });

  it("rejects invalid range ordering", () => {
    assert.throws(
      () => parseOptions({ range: [500, 400] }),
      /range\[0\] must be less than range\[1\]/,
    );
  });

  it("createChallenge throws for invalid options", () => {
    assert.throws(
      () => createChallenge("c1", { players: 3 }),
      /Invalid literal value/,
    );
  });
});
