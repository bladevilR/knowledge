export type AgentKey = "archive" | "graph" | "compose";

export type PixelAnimation = "idle" | "walk" | "reading" | "typing";

export type AgentTool = "Read" | "Search" | "Write" | null;

export type AgentBubble = "waiting" | null;

export type AgentLocation = "idle" | "desk";

export type AgentRuntime = {
  active: boolean;
  tool: AgentTool;
  bubble: AgentBubble;
  location: AgentLocation;
  destination: AgentLocation;
};

export type OfficeRuntimeState = Record<AgentKey, AgentRuntime>;

export type OfficeStageEvent =
  | { type: "reset" }
  | { type: "startWork"; agent: AgentKey; tool: Exclude<AgentTool, null> }
  | { type: "arrive"; agent: AgentKey }
  | { type: "finishWork"; agent: AgentKey; showWaitingBubble?: boolean }
  | { type: "returnToIdle"; agent: AgentKey }
  | { type: "clearBubble"; agent: AgentKey };

function createAgentRuntime(): AgentRuntime {
  return {
    active: false,
    tool: null,
    bubble: null,
    location: "idle",
    destination: "idle",
  };
}

export function createOfficeRuntimeState(): OfficeRuntimeState {
  return {
    archive: createAgentRuntime(),
    graph: createAgentRuntime(),
    compose: createAgentRuntime(),
  };
}

function patchAgent(
  state: OfficeRuntimeState,
  agent: AgentKey,
  patch: Partial<AgentRuntime>,
): OfficeRuntimeState {
  return {
    ...state,
    [agent]: {
      ...state[agent],
      ...patch,
    },
  };
}

export function applyOfficeStageEvent(
  state: OfficeRuntimeState,
  event: OfficeStageEvent,
): OfficeRuntimeState {
  switch (event.type) {
    case "reset":
      return createOfficeRuntimeState();
    case "startWork":
      return patchAgent(state, event.agent, {
        active: true,
        tool: event.tool,
        bubble: null,
        destination: "desk",
      });
    case "arrive":
      return patchAgent(state, event.agent, {
        location: state[event.agent].destination,
      });
    case "finishWork":
      return patchAgent(state, event.agent, {
        active: false,
        tool: null,
        bubble: event.showWaitingBubble ? "waiting" : null,
        destination: "desk",
      });
    case "returnToIdle":
      return patchAgent(state, event.agent, {
        destination: "idle",
      });
    case "clearBubble":
      return patchAgent(state, event.agent, {
        bubble: null,
      });
    default:
      return state;
  }
}

export function isReadingTool(tool: AgentTool): boolean {
  return tool === "Read" || tool === "Search";
}

export function deriveAgentAnimation(agent: AgentRuntime): PixelAnimation {
  if (agent.location !== agent.destination) {
    return "walk";
  }
  if (!agent.active || !agent.tool) {
    return "idle";
  }
  return isReadingTool(agent.tool) ? "reading" : "typing";
}
