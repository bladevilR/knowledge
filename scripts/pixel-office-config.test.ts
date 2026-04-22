import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deriveAgentSlotsFromLayout } from "../src/pixelOfficeConfig.ts";

const layoutPath = path.resolve("public/pixel-agents/assets/default-layout-1.json");
const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8")) as {
  cols: number;
  rows: number;
  tiles: number[];
  furniture: Array<{ uid: string; type: string; col: number; row: number }>;
};

const slots = deriveAgentSlotsFromLayout(layout);

assert.equal(slots.length, 3);
assert.deepEqual(
  slots.map((slot) => [slot.workCol, slot.workRow]),
  [
    [3, 14],
    [7, 14],
    [3, 17],
  ],
);
assert.deepEqual(
  slots.map((slot) => slot.workDirection),
  ["up", "up", "right"],
);

console.log("pixel office config tests passed");
