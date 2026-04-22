import assert from "node:assert/strict";

import {
  applyOfficeStageEvent,
  createOfficeRuntimeState,
  deriveAgentAnimation,
} from "../src/pixelOfficeState.ts";

let state = createOfficeRuntimeState();

state = applyOfficeStageEvent(state, { type: "startWork", agent: "archive", tool: "Read" });
assert.equal(state.archive.active, true);
assert.equal(state.archive.tool, "Read");
assert.equal(state.archive.destination, "desk");
assert.equal(deriveAgentAnimation(state.archive), "walk");

state = applyOfficeStageEvent(state, { type: "arrive", agent: "archive" });
assert.equal(state.archive.location, "desk");
assert.equal(deriveAgentAnimation(state.archive), "reading");

state = applyOfficeStageEvent(state, { type: "finishWork", agent: "archive" });
assert.equal(state.archive.active, false);
assert.equal(state.archive.tool, null);
assert.equal(state.archive.destination, "desk");
assert.equal(deriveAgentAnimation(state.archive), "idle");

state = applyOfficeStageEvent(state, { type: "returnToIdle", agent: "archive" });
assert.equal(state.archive.destination, "idle");
assert.equal(deriveAgentAnimation(state.archive), "walk");

state = applyOfficeStageEvent(state, { type: "arrive", agent: "archive" });
assert.equal(state.archive.location, "idle");
assert.equal(deriveAgentAnimation(state.archive), "idle");

state = applyOfficeStageEvent(state, { type: "startWork", agent: "compose", tool: "Write" });
state = applyOfficeStageEvent(state, { type: "arrive", agent: "compose" });
assert.equal(deriveAgentAnimation(state.compose), "typing");

state = applyOfficeStageEvent(state, { type: "finishWork", agent: "compose", showWaitingBubble: true });
assert.equal(state.compose.bubble, "waiting");
assert.equal(deriveAgentAnimation(state.compose), "idle");

state = applyOfficeStageEvent(state, { type: "clearBubble", agent: "compose" });
assert.equal(state.compose.bubble, null);

console.log("pixel office state tests passed");
