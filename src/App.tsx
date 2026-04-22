import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Cpu,
  Database,
  FileText,
  HardDrive,
  History,
  Loader2,
  Lock,
  Menu,
  MessageSquare,
  Network,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import {
  applyOfficeStageEvent,
  createOfficeRuntimeState,
  deriveAgentAnimation,
  type AgentBubble,
  type AgentKey,
  type AgentLocation,
  type AgentTool,
  type OfficeRuntimeState,
  type OfficeStageEvent,
  type PixelAnimation,
} from "./pixelOfficeState";
import { deriveAgentSlotsFromLayout } from "./pixelOfficeConfig";

type SourceItem = {
  id: string;
  title: string;
  excerpt: string;
};

type GraphItem = {
  id: string;
  title: string;
  type: string;
  excerpt: string;
  score?: number;
};

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  graphItems?: GraphItem[];
  durationMs?: number;
};

type ChatResponse = {
  ok: boolean;
  answer?: string;
  sources?: SourceItem[];
  graphItems?: GraphItem[];
  durationMs?: number;
  error?: string;
};

type ChatStreamStage =
  | "archive:start"
  | "archive:done"
  | "graph:start"
  | "graph:done"
  | "compose:start";

type ChatStreamEvent =
  | { type: "stage"; stage: ChatStreamStage; durationMs?: number }
  | ({ type: "final" } & ChatResponse)
  | { type: "error"; error: string; durationMs?: number };

type ModelStatus = {
  ok: boolean;
  modelName: string;
  archiveReady: boolean;
  modelReady: boolean;
  graphReady?: boolean;
  graphNodeCount?: number;
  graphEdgeCount?: number;
  abilities: string[];
};

type PixelAgent = {
  name: string;
  role: string;
  detail: string;
  sprite: string;
  active: boolean;
  bubble: AgentBubble;
  location: AgentLocation;
  destination: AgentLocation;
  tool: AgentTool;
  animation: PixelAnimation;
};

type AgentMotion = {
  archive: PixelAnimation;
  graph: PixelAnimation;
  compose: PixelAnimation;
};

type AppView = "chat" | "admin";

type DialogueTurn = {
  id: string;
  question: string;
  answer?: string;
  sources: SourceItem[];
  graphItems: GraphItem[];
  durationMs?: number;
};

const starters = [
  "三重一大制度主要说什么？",
  "钢轨探伤周期相关材料有哪些？",
  "门禁系统和AFC系统有哪些关联资料？",
];

const welcomeMessage: ChatItem = {
  id: "hello",
  role: "assistant",
  content:
    "你好，我可以帮你查本机档案，并结合知识图谱线索整理中文回答。你可以直接问制度、系统、材料、会议纪要、演示文稿或项目依据。",
};

const BRANDING = {
  mark: "/branding/szm-mark.png",
  full: "/branding/szm-logo.png",
};

type OfficeLayout = {
  cols: number;
  rows: number;
  tiles: number[];
  furniture: Array<{
    uid: string;
    type: string;
    col: number;
    row: number;
  }>;
};

const OFFICE_LAYOUT_URL = "/pixel-agents/assets/default-layout-1.json";

const OFFICE_TILE_COLORS: Record<number, string> = {
  255: "#171c29",
  0: "#2f3b55",
  1: "#e8ddd6",
  7: "#aa7446",
  9: "#577da0",
};

const OFFICE_FURNITURE: Record<
  string,
  { src: string; width: number; height: number; mirror?: boolean }
> = {
  TABLE_FRONT: {
    src: "/pixel-agents/assets/furniture/TABLE_FRONT/TABLE_FRONT.png",
    width: 48,
    height: 64,
  },
  COFFEE_TABLE: {
    src: "/pixel-agents/assets/furniture/COFFEE_TABLE/COFFEE_TABLE.png",
    width: 32,
    height: 32,
  },
  SOFA_FRONT: {
    src: "/pixel-agents/assets/furniture/SOFA/SOFA_FRONT.png",
    width: 32,
    height: 16,
  },
  SOFA_BACK: {
    src: "/pixel-agents/assets/furniture/SOFA/SOFA_BACK.png",
    width: 32,
    height: 16,
  },
  SOFA_SIDE: {
    src: "/pixel-agents/assets/furniture/SOFA/SOFA_SIDE.png",
    width: 16,
    height: 32,
  },
  "SOFA_SIDE:left": {
    src: "/pixel-agents/assets/furniture/SOFA/SOFA_SIDE.png",
    width: 16,
    height: 32,
    mirror: true,
  },
  HANGING_PLANT: {
    src: "/pixel-agents/assets/furniture/HANGING_PLANT/HANGING_PLANT.png",
    width: 16,
    height: 32,
  },
  DOUBLE_BOOKSHELF: {
    src: "/pixel-agents/assets/furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png",
    width: 32,
    height: 32,
  },
  SMALL_PAINTING: {
    src: "/pixel-agents/assets/furniture/SMALL_PAINTING/SMALL_PAINTING.png",
    width: 16,
    height: 32,
  },
  SMALL_PAINTING_2: {
    src: "/pixel-agents/assets/furniture/SMALL_PAINTING_2/SMALL_PAINTING_2.png",
    width: 16,
    height: 32,
  },
  CLOCK: {
    src: "/pixel-agents/assets/furniture/CLOCK/CLOCK.png",
    width: 16,
    height: 32,
  },
  PLANT: {
    src: "/pixel-agents/assets/furniture/PLANT/PLANT.png",
    width: 16,
    height: 32,
  },
  COFFEE: {
    src: "/pixel-agents/assets/furniture/COFFEE/COFFEE.png",
    width: 16,
    height: 16,
  },
  WOODEN_CHAIR_SIDE: {
    src: "/pixel-agents/assets/furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png",
    width: 16,
    height: 32,
  },
  "WOODEN_CHAIR_SIDE:left": {
    src: "/pixel-agents/assets/furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png",
    width: 16,
    height: 32,
    mirror: true,
  },
  DESK_FRONT: {
    src: "/pixel-agents/assets/furniture/DESK/DESK_FRONT.png",
    width: 48,
    height: 32,
  },
  CUSHIONED_BENCH: {
    src: "/pixel-agents/assets/furniture/CUSHIONED_BENCH/CUSHIONED_BENCH.png",
    width: 16,
    height: 16,
  },
  PC_FRONT_OFF: {
    src: "/pixel-agents/assets/furniture/PC/PC_FRONT_OFF.png",
    width: 16,
    height: 32,
  },
  PC_SIDE: {
    src: "/pixel-agents/assets/furniture/PC/PC_SIDE.png",
    width: 16,
    height: 32,
  },
  "PC_SIDE:left": {
    src: "/pixel-agents/assets/furniture/PC/PC_SIDE.png",
    width: 16,
    height: 32,
    mirror: true,
  },
  PLANT_2: {
    src: "/pixel-agents/assets/furniture/PLANT_2/PLANT_2.png",
    width: 16,
    height: 32,
  },
  LARGE_PAINTING: {
    src: "/pixel-agents/assets/furniture/LARGE_PAINTING/LARGE_PAINTING.png",
    width: 32,
    height: 32,
  },
  BIN: {
    src: "/pixel-agents/assets/furniture/BIN/BIN.png",
    width: 16,
    height: 16,
  },
  SMALL_TABLE_FRONT: {
    src: "/pixel-agents/assets/furniture/SMALL_TABLE/SMALL_TABLE_FRONT.png",
    width: 32,
    height: 32,
  },
  SMALL_TABLE_SIDE: {
    src: "/pixel-agents/assets/furniture/SMALL_TABLE/SMALL_TABLE_SIDE.png",
    width: 16,
    height: 48,
  },
};

const OFFICE_AGENT_SLOTS = [
  {
    idleCol: 2,
    idleRow: 16,
    idleDirection: "right",
    idleMirrored: false,
    workCol: 3,
    workRow: 14,
    workDirection: "down",
    workMirrored: false,
    walkDirection: "right",
    walkMirrored: false,
  },
  {
    idleCol: 8,
    idleRow: 16,
    idleDirection: "right",
    idleMirrored: true,
    workCol: 7,
    workRow: 14,
    workDirection: "down",
    workMirrored: false,
    walkDirection: "right",
    walkMirrored: true,
  },
  {
    idleCol: 15,
    idleRow: 16,
    idleDirection: "right",
    idleMirrored: true,
    workCol: 14,
    workRow: 15,
    workDirection: "right",
    workMirrored: false,
    walkDirection: "right",
    walkMirrored: true,
  },
] as const;

const PIXEL_REFERENCE = {
  office: "/pixel-agents/reference/official-office.jpg",
  banner: "/pixel-agents/reference/banner.png",
};

const WALK_TO_DESK_MS = 650;
const RETURN_TO_IDLE_MS = 1200;
const WAITING_BUBBLE_MS = 1800;

const IDLE_AGENT_MOTION: AgentMotion = {
  archive: "idle",
  graph: "idle",
  compose: "idle",
};

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(value?: number): string {
  if (!value) {
    return "";
  }
  if (value < 1000) {
    return `${value}毫秒`;
  }
  return `${(value / 1000).toFixed(1)}秒`;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    const failed = data as ChatResponse;
    throw new Error(failed.error || "请求失败");
  }
  return data;
}

async function streamChatRequest(
  question: string,
  history: Array<{ role: "user"; content: string }>,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: question,
      history,
    }),
  });

  if (!response.ok) {
    throw new Error((await readJson<ChatResponse>(response)).error || "璇锋眰澶辫触");
  }
  if (!response.body) {
    throw new Error("No readable response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        onEvent(JSON.parse(line) as ChatStreamEvent);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const tail = buffer.trim();
  if (tail) {
    onEvent(JSON.parse(tail) as ChatStreamEvent);
  }
}

export default function App() {
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<AppView>("chat");
  const [messages, setMessages] = useState<ChatItem[]>([welcomeMessage]);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [agentMotion, setAgentMotion] = useState<AgentMotion>(IDLE_AGENT_MOTION);
  const [officeRuntime, setOfficeRuntime] = useState<OfficeRuntimeState>(() => createOfficeRuntimeState());
  const listRef = useRef<HTMLDivElement | null>(null);
  const agentRunRef = useRef(0);
  const agentTimerRef = useRef<number[]>([]);

  function clearAgentTimers() {
    agentTimerRef.current.forEach((timer) => window.clearTimeout(timer));
    agentTimerRef.current = [];
  }

  function queueOfficeEvent(event: OfficeStageEvent, delay: number, runId: number) {
    const timer = window.setTimeout(() => {
      if (agentRunRef.current === runId) {
        setOfficeRuntime((current) => applyOfficeStageEvent(current, event));
      }
    }, delay);
    agentTimerRef.current.push(timer);
  }

  function queueAgentMotion(nextMotion: AgentMotion, delay: number, runId: number) {
    const timer = window.setTimeout(() => {
      if (agentRunRef.current === runId) {
        setAgentMotion(nextMotion);
      }
    }, delay);
    agentTimerRef.current.push(timer);
  }

  function runOfficeEvent(event: OfficeStageEvent, runId = agentRunRef.current) {
    setOfficeRuntime((current) => applyOfficeStageEvent(current, event));

    if (event.type === "startWork") {
      queueOfficeEvent({ type: "arrive", agent: event.agent }, WALK_TO_DESK_MS, runId);
      return;
    }

    if (event.type === "finishWork") {
      if (event.showWaitingBubble) {
        queueOfficeEvent({ type: "clearBubble", agent: event.agent }, WAITING_BUBBLE_MS, runId);
        queueOfficeEvent({ type: "returnToIdle", agent: event.agent }, WAITING_BUBBLE_MS, runId);
        queueOfficeEvent({ type: "arrive", agent: event.agent }, WAITING_BUBBLE_MS + WALK_TO_DESK_MS, runId);
        return;
      }

      queueOfficeEvent({ type: "returnToIdle", agent: event.agent }, RETURN_TO_IDLE_MS, runId);
      queueOfficeEvent({ type: "arrive", agent: event.agent }, RETURN_TO_IDLE_MS + WALK_TO_DESK_MS, runId);
    }
  }

  function handleChatStage(stage: ChatStreamStage, runId: number) {
    switch (stage) {
      case "archive:start":
        runOfficeEvent({ type: "startWork", agent: "archive", tool: "Read" }, runId);
        return;
      case "archive:done":
        runOfficeEvent({ type: "finishWork", agent: "archive" }, runId);
        return;
      case "graph:start":
        if (status?.graphReady) {
          runOfficeEvent({ type: "startWork", agent: "graph", tool: "Search" }, runId);
        }
        return;
      case "graph:done":
        if (status?.graphReady) {
          runOfficeEvent({ type: "finishWork", agent: "graph" }, runId);
        }
        return;
      case "compose:start":
        runOfficeEvent({ type: "startWork", agent: "compose", tool: "Write" }, runId);
        return;
    }
  }

  const legacyPixelAgents = useMemo<PixelAgent[]>(
    () => [
      {
        name: "档案检索员",
        role: agentMotion.archive === "walk"
          ? "正走向档案工位"
          : agentMotion.archive === "reading"
            ? "正在查阅档案"
            : status?.archiveReady
              ? "索引待命"
              : "等待档案库",
        detail: agentMotion.archive === "walk" ? "先回到座位，再翻原文" : "先看原文，再给摘要",
        sprite: "/pixel-agents/characters/char_0.png",
        active: agentMotion.archive !== "idle",
        animation: agentMotion.archive,
      },
      {
        name: "图谱联络员",
        role: agentMotion.graph === "walk"
          ? "正走向图谱工位"
          : agentMotion.graph === "reading"
            ? "正在串联线索"
            : status?.graphReady
              ? "图谱待命"
              : "等待图谱",
        detail: agentMotion.graph === "reading" ? "正在补关系和上下文" : "找制度、系统、部门关系",
        sprite: "/pixel-agents/characters/char_1.png",
        active: agentMotion.graph !== "idle",
        animation: agentMotion.graph,
      },
      {
        name: "答案整理员",
        role: agentMotion.compose === "walk"
          ? "正回到工位准备整理"
          : agentMotion.compose === "typing"
            ? "正在整理回答"
            : status?.modelReady
              ? "模型待命"
              : "等待模型",
        detail: agentMotion.compose === "typing" ? "把检索结果整理成回答" : "只按资料说话",
        sprite: "/pixel-agents/characters/char_2.png",
        active: agentMotion.compose !== "idle",
        animation: agentMotion.compose,
      },
    ],
    [agentMotion, status?.archiveReady, status?.graphReady, status?.modelReady],
  );

  const pixelAgents = useMemo<PixelAgent[]>(() => {
    const archiveAnimation = deriveAgentAnimation(officeRuntime.archive);
    const graphAnimation = deriveAgentAnimation(officeRuntime.graph);
    const composeAnimation = deriveAgentAnimation(officeRuntime.compose);

    return [
      {
        name: "档案检索员",
        role:
          archiveAnimation === "walk"
            ? "正走向档案工位"
            : archiveAnimation === "reading"
              ? "正在查阅档案"
              : officeRuntime.archive.bubble === "waiting"
                ? "等待下一条指令"
                : status?.archiveReady
                  ? "索引待命"
                  : "等待档案库",
        detail:
          archiveAnimation === "walk"
            ? "回到工位后再翻原文"
            : archiveAnimation === "reading"
              ? "直接读原文证据"
              : "先找证据，再给结论",
        sprite: "/pixel-agents/characters/char_0.png",
        active: officeRuntime.archive.active,
        bubble: officeRuntime.archive.bubble,
        location: officeRuntime.archive.location,
        destination: officeRuntime.archive.destination,
        tool: officeRuntime.archive.tool,
        animation: archiveAnimation,
      },
      {
        name: "图谱联络员",
        role:
          graphAnimation === "walk"
            ? "正走向图谱工位"
            : graphAnimation === "reading"
              ? "正在串联线索"
              : officeRuntime.graph.bubble === "waiting"
                ? "等待下一条指令"
                : status?.graphReady
                  ? "图谱待命"
                  : "知识图谱未接入",
        detail:
          graphAnimation === "walk"
            ? "回到工位后再查关系"
            : graphAnimation === "reading"
              ? "补关系和上下文"
              : "只在图谱可用时参与",
        sprite: "/pixel-agents/characters/char_1.png",
        active: officeRuntime.graph.active,
        bubble: officeRuntime.graph.bubble,
        location: officeRuntime.graph.location,
        destination: officeRuntime.graph.destination,
        tool: officeRuntime.graph.tool,
        animation: graphAnimation,
      },
      {
        name: "答案整理员",
        role:
          composeAnimation === "walk"
            ? "正回到工位准备整理"
            : composeAnimation === "typing"
              ? "正在整理回答"
              : officeRuntime.compose.bubble === "waiting"
                ? "已整理完，等待下一问"
                : status?.modelReady
                  ? "模型待命"
                  : "等待模型",
        detail:
          composeAnimation === "walk"
            ? "回到工位后再开始整理"
            : composeAnimation === "typing"
              ? "把证据整理成回答"
              : "回答完成后会短暂停留",
        sprite: "/pixel-agents/characters/char_2.png",
        active: officeRuntime.compose.active,
        bubble: officeRuntime.compose.bubble,
        location: officeRuntime.compose.location,
        destination: officeRuntime.compose.destination,
        tool: officeRuntime.compose.tool,
        animation: composeAnimation,
      },
    ];
  }, [officeRuntime, status?.archiveReady, status?.graphReady, status?.modelReady]);

  const readyText = useMemo(() => {
    if (!status) {
      return "正在检查";
    }
    if (status.archiveReady && status.modelReady) {
      return "可以提问";
    }
    if (!status.modelReady) {
      return "模型未就绪";
    }
    return "档案库未就绪";
  }, [status]);

  const statusItems = useMemo(
    () => [
      {
        label: status?.modelName || "内网问答模型",
        ok: Boolean(status?.modelReady),
      },
      {
        label: "本地档案库",
        ok: Boolean(status?.archiveReady),
      },
      {
        label: status?.graphReady && status.graphNodeCount
          ? `知识图谱 ${status.graphNodeCount.toLocaleString()} 节点`
          : "知识图谱",
        ok: Boolean(status?.graphReady),
      },
    ],
    [status?.archiveReady, status?.graphNodeCount, status?.graphReady, status?.modelName, status?.modelReady],
  );

  const dialogueTurns = useMemo<DialogueTurn[]>(() => {
    const turns: DialogueTurn[] = [];
    for (const message of messages) {
      if (message.id === welcomeMessage.id) {
        continue;
      }
      if (message.role === "user") {
        turns.push({
          id: message.id,
          question: message.content,
          sources: [],
          graphItems: [],
        });
        continue;
      }
      const lastTurn = turns[turns.length - 1];
      if (lastTurn && !lastTurn.answer) {
        lastTurn.answer = message.content;
        lastTurn.sources = message.sources || [];
        lastTurn.graphItems = message.graphItems || [];
        lastTurn.durationMs = message.durationMs;
      }
    }
    return turns;
  }, [messages]);

  const adminStats = useMemo(
    () => [
      { label: "对话轮次", value: dialogueTurns.length },
      { label: "消息总数", value: messages.filter((message) => message.id !== welcomeMessage.id).length },
      {
        label: "资料引用",
        value: messages.reduce((total, message) => total + (message.sources?.length || 0), 0),
      },
      {
        label: "图谱线索",
        value: messages.reduce((total, message) => total + (message.graphItems?.length || 0), 0),
      },
    ],
    [dialogueTurns.length, messages],
  );

  useEffect(() => {
    fetch("/api/model/status")
      .then((response) => readJson<ModelStatus>(response))
      .then((data) => {
        setStatus(data);
        setStatusError("");
      })
      .catch((error) => {
        setStatusError(error instanceof Error ? error.message : String(error));
      });
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => () => clearAgentTimers(), []);

  async function legacyAskQuestion(questionText: string) {
    const question = questionText.trim();
    if (!question || loading) {
      return;
    }

    const userMessage: ChatItem = {
      id: createId(),
      role: "user",
      content: question,
    };
    const visibleHistory = messages
      .filter((item) => item.id !== "hello" && item.role === "user")
      .slice(-4)
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    clearAgentTimers();
    agentRunRef.current += 1;
    const runId = agentRunRef.current;
    setAgentMotion({
      archive: "walk",
      graph: status?.graphReady ? "walk" : "idle",
      compose: "idle",
    });
    queueAgentMotion(
      {
        archive: "reading",
        graph: status?.graphReady ? "reading" : "idle",
        compose: "idle",
      },
      700,
      runId,
    );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: visibleHistory,
        }),
      });
      const data = await readJson<ChatResponse>(response);
      clearAgentTimers();
      setAgentMotion({
        archive: "idle",
        graph: "idle",
        compose: "walk",
      });
      queueAgentMotion(
        {
          archive: "idle",
          graph: "idle",
          compose: "typing",
        },
        650,
        runId,
      );
      queueAgentMotion({ ...IDLE_AGENT_MOTION }, 2200, runId);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: data.answer || "模型没有返回内容。",
          sources: data.sources || [],
          graphItems: data.graphItems || [],
          durationMs: data.durationMs,
        },
      ]);
    } catch (error) {
      clearAgentTimers();
      setAgentMotion({ ...IDLE_AGENT_MOTION });
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: `这次没答出来：${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function askQuestion(questionText: string) {
    const question = questionText.trim();
    if (!question || loading) {
      return;
    }

    const userMessage: ChatItem = {
      id: createId(),
      role: "user",
      content: question,
    };
    const visibleHistory = messages
      .filter((item) => item.id !== "hello" && item.role === "user")
      .slice(-4)
      .map((item) => ({ role: item.role, content: item.content as string }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    clearAgentTimers();
    agentRunRef.current += 1;
    const runId = agentRunRef.current;
    setOfficeRuntime(createOfficeRuntimeState());

    try {
      let finalPayload: ChatResponse | null = null;
      let streamError = "";

      await streamChatRequest(question, visibleHistory, (event) => {
        if (agentRunRef.current !== runId) {
          return;
        }

        if (event.type === "stage") {
          handleChatStage(event.stage, runId);
          return;
        }

        if (event.type === "error") {
          streamError = event.error;
          return;
        }

        finalPayload = event;
        runOfficeEvent({ type: "finishWork", agent: "compose", showWaitingBubble: true }, runId);
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content: event.answer || "模型没有返回内容。",
            sources: event.sources || [],
            graphItems: event.graphItems || [],
            durationMs: event.durationMs,
          },
        ]);
      });

      if (streamError) {
        throw new Error(streamError);
      }
      if (!finalPayload) {
        throw new Error("没有收到最终回答。");
      }
    } catch (error) {
      clearAgentTimers();
      setOfficeRuntime(createOfficeRuntimeState());
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: `这次没答出来：${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void askQuestion(input);
  }

  function handleAdminLogin(event: FormEvent) {
    event.preventDefault();
    if (adminUsername === "admin" && adminPassword === "ai88888888") {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminUsername("");
      setAdminPassword("");
      setAdminError("");
      setActiveView("admin");
      return;
    }
    setAdminError("用户名或密码不正确");
  }

  function handleAdminLogout() {
    setIsAdmin(false);
    setActiveView("chat");
    setAdminError("");
  }

  function resetConversation() {
    clearAgentTimers();
    setAgentMotion({ ...IDLE_AGENT_MOTION });
    setOfficeRuntime(createOfficeRuntimeState());
    setMessages([welcomeMessage]);
    setInput("");
    setActiveView("chat");
  }

  function exportConversation() {
    const payload = {
      exportedAt: new Date().toISOString(),
      turns: dialogueTurns,
      messages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `archive-conversations-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#eef3f6] font-sans text-slate-800">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#f7fbf8_0%,#e6f1f2_45%,#f6eef1_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(15,95,87,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(15,95,87,0.14)_1px,transparent_1px)] [background-size:34px_34px]" />

      <aside
        className={`relative z-20 flex h-full shrink-0 flex-col border-r border-white/70 bg-white/45 shadow-[4px_0_24px_rgba(38,77,80,0.05)] backdrop-blur-2xl transition-[width] duration-500 ease-out ${
          isSidebarOpen ? "w-[280px]" : "w-[88px]"
        }`}
      >
        <div className="relative flex items-center gap-4 p-6">
          <div className="absolute bottom-0 left-6 right-6 h-px bg-[linear-gradient(90deg,transparent,rgba(71,85,105,0.28),transparent)]" />
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/80 bg-white/85 text-slate-700 shadow-[0_4px_14px_rgba(15,95,87,0.12)] transition hover:bg-white"
            type="button"
            onClick={() => setIsSidebarOpen((value) => !value)}
            title="切换侧栏"
          >
            <img alt="苏州地铁标识" className="h-6 w-6 object-contain" src={BRANDING.mark} />
          </button>
          {isSidebarOpen && (
            <div className="min-w-0 animate-[fade-in_0.35s_ease-out] overflow-hidden whitespace-nowrap">
              <img alt="苏州地铁" className="h-8 w-auto max-w-[172px] object-contain" src={BRANDING.full} />
              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
                Archive Demo Console
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <div className="space-y-1.5">
            <NavItem icon={<MessageSquare className="h-4 w-4" />} label="新对话" active isOpen={isSidebarOpen} />
            <NavItem icon={<BookOpen className="h-4 w-4" />} label="线网知识图谱" isOpen={isSidebarOpen} />
            <NavItem icon={<Database className="h-4 w-4" />} label="本地部署状态" isOpen={isSidebarOpen} />
            <NavItem icon={<History className="h-4 w-4" />} label="查询审计日志" isOpen={isSidebarOpen} />
          </div>

          <div className="px-3 pb-3 pt-8">
            {isSidebarOpen ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">企业业务流</p>
            ) : (
              <div className="mx-auto h-px w-8 bg-slate-300/60" />
            )}
          </div>

          <div className="space-y-1.5">
            <NavItem icon={<ShieldAlert className="h-4 w-4" />} label="大客流应急响应" isOpen={isSidebarOpen} />
            <NavItem icon={<FileText className="h-4 w-4" />} label="安监审查规范" isOpen={isSidebarOpen} />
          </div>
        </nav>

        <div className="m-3 rounded-lg border border-white/70 bg-white/45 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white bg-slate-100 shadow-inner">
                <img alt="" className="h-5 w-5 object-contain" src={BRANDING.mark} />
              </div>
              <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-lg border-2 border-white bg-emerald-400" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0 overflow-hidden whitespace-nowrap">
                <span className="block text-sm font-semibold text-slate-800">SZM-8291</span>
                <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-500">
                  <Lock className="h-3 w-3 text-slate-400" />
                  企业内网授权
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex h-full min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/70 bg-white/45 text-slate-500 shadow-sm backdrop-blur-xl transition hover:bg-white/70 hover:text-slate-800"
              type="button"
              onClick={() => setIsSidebarOpen((value) => !value)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden rounded-lg border border-white/70 bg-white/45 px-3 py-1.5 text-xs font-semibold text-[#0f5f57] shadow-sm backdrop-blur-xl md:inline-flex">
              archive 演示工作台
            </span>
            <div className="flex rounded-lg border border-white/70 bg-white/45 p-1 shadow-sm backdrop-blur-xl">
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeView === "chat" ? "bg-white text-[#0f5f57] shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setActiveView("chat")}
                type="button"
              >
                问答
              </button>
              {isAdmin && (
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeView === "admin" ? "bg-white text-[#9b3552] shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => setActiveView("admin")}
                  type="button"
                >
                  管理
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-lg border border-white/70 bg-white/45 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-xl sm:flex">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-[#176b8c]" />
                Core: Qwen-Max
              </span>
              <div className="h-3 w-px bg-slate-300" />
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
                Docs Sync: {status?.archiveReady ? "100%" : "checking"}
              </span>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/70 bg-white/45 text-slate-500 shadow-sm backdrop-blur-xl transition hover:bg-white/70 hover:text-slate-800" type="button">
              <Settings className="h-5 w-5" />
            </button>
            {isAdmin ? (
              <button
                className="rounded-lg border border-white/70 bg-white/55 px-3 py-2 text-xs font-semibold text-[#9b3552] shadow-sm backdrop-blur-xl transition hover:bg-white/80"
                onClick={handleAdminLogout}
                type="button"
              >
                admin 退出
              </button>
            ) : (
              <button
                className="rounded-lg border border-white/70 bg-white/55 px-3 py-2 text-xs font-semibold text-[#0f5f57] shadow-sm backdrop-blur-xl transition hover:bg-white/80"
                onClick={() => setShowAdminLogin((value) => !value)}
                type="button"
              >
                管理员登录
              </button>
            )}
          </div>
        </header>

        {showAdminLogin && !isAdmin && (
          <form
            className="absolute right-6 top-16 z-40 grid w-72 gap-3 rounded-lg border border-white/80 bg-white/85 p-4 shadow-[0_16px_46px_rgba(38,77,80,0.14)] backdrop-blur-2xl"
            onSubmit={handleAdminLogin}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0f5f57]">Admin Login</p>
              <h2 className="text-lg font-extrabold text-slate-800">管理员入口</h2>
            </div>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              用户名
              <input
                className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[#0f5f57]"
                onChange={(event) => setAdminUsername(event.target.value)}
                value={adminUsername}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              密码
              <input
                className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[#0f5f57]"
                onChange={(event) => setAdminPassword(event.target.value)}
                type="password"
                value={adminPassword}
                autoComplete="current-password"
              />
            </label>
            {adminError && <p className="text-xs font-semibold text-[#9b3552]">{adminError}</p>}
            <button className="rounded-lg bg-[#0f5f57] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0c514b]" type="submit">
              登录
            </button>
          </form>
        )}

        <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-36 pt-6">
          <section className={`${activeView === "chat" ? "grid" : "hidden"} mx-auto w-full max-w-6xl gap-5`}>
            <div className="grid gap-5">
              <div className="rounded-lg border border-white/70 bg-white/45 p-6 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/70 bg-white/50 px-3 py-1.5 text-xs font-semibold tracking-widest text-[#0f5f57] shadow-sm">
                  <img alt="苏州地铁" className="h-5 w-auto object-contain" src={BRANDING.full} />
                  <div className="h-4 w-px bg-slate-300/70" />
                  <Sparkles className="h-3.5 w-3.5 text-[#9b3552]" />
                  Archive Internal AI
                </div>
                <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-800 md:text-5xl">
                  轨交业务智库 <span className="text-[#0f5f57]">Pro</span>
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-slate-600">
                  基于苏州地铁私有云部署的数据中枢。archive 会先检索本地档案，再结合知识图谱线索整理可核验的中文回答。
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-3">
                  {statusItems.map((item) => (
                    <div className="rounded-lg border border-white/70 bg-white/55 px-3 py-2 text-sm shadow-sm" key={item.label}>
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <span className={`h-2 w-2 rounded-lg ${item.ok ? "bg-emerald-500" : "bg-[#d36b6f]"}`} />
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs font-medium text-slate-500">{statusError || readyText}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <GlassCard
                title="行车与客运规章"
                desc="查询列车运行图、大客流组织及突发情况应急预案。"
                icon={<BookOpen className="h-6 w-6 text-[#176b8c]" />}
                onClick={() => void askQuestion(starters[0])}
                disabled={loading}
              />
              <GlassCard
                title="机电与信号维保"
                desc="检索探伤周期、门禁、AFC、站台门和维保技术资料。"
                icon={<Cpu className="h-6 w-6 text-emerald-600" />}
                onClick={() => void askQuestion(starters[1])}
                disabled={loading}
              />
              <GlassCard
                title="安全文明审查"
                desc="检查施工审批、红线标准、安监材料和制度依据。"
                icon={<ShieldAlert className="h-6 w-6 text-[#9b3552]" />}
                onClick={() => void askQuestion(starters[2])}
                disabled={loading}
              />
            </div>

            <section className="rounded-lg border border-white/70 bg-white/50 p-4 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0f5f57]">Archive Chat</p>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-800">问答流</h2>
                </div>
                {loading && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-white/80 bg-white/65 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在查档案
                  </span>
                )}
              </div>

              <div ref={listRef} className="grid max-h-[390px] gap-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id}>
                    <ChatBubble message={message} />
                  </div>
                ))}
                {loading && (
                  <div className="max-w-3xl rounded-lg border border-white/70 bg-white/70 p-4 text-sm font-medium text-slate-600 shadow-sm">
                    正在查档案并组织答案...
                  </div>
                )}
              </div>
            </section>
          </section>

          {activeView === "admin" && (
            <AdminPanel
              agents={pixelAgents}
              dialogueTurns={dialogueTurns}
              exportConversation={exportConversation}
              messages={messages}
              resetConversation={resetConversation}
              stats={adminStats}
            />
          )}
        </div>

        <div className={`${activeView === "chat" ? "pointer-events-none" : "hidden"} absolute bottom-0 left-0 z-30 w-full p-6`}>
          <form className="pointer-events-auto mx-auto w-full max-w-3xl" onSubmit={submit}>
            <div className="rounded-lg border border-white/80 bg-white/65 p-2 shadow-[0_12px_50px_rgba(38,77,80,0.13)] backdrop-blur-3xl transition focus-within:bg-white/80">
              <div className="flex items-center gap-3 pl-2">
                <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg border border-white bg-slate-100/70 text-slate-400 sm:grid">
                  <Search className="h-5 w-5" />
                </div>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      submit(event);
                    }
                  }}
                  placeholder="询问规章、故障代码、或输入检索条件..."
                  className="max-h-32 min-h-[52px] flex-1 resize-none bg-transparent py-3.5 text-[16px] font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-500"
                  rows={1}
                />
                <button
                  className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg border px-5 font-semibold transition ${
                    input.trim() && !loading
                      ? "border-[#0f5f57] bg-[#0f5f57] text-white shadow-[0_4px_14px_rgba(15,95,87,0.25)] hover:bg-[#0c514b]"
                      : "border-white bg-white/50 text-slate-400"
                  }`}
                  disabled={!input.trim() || loading}
                  type="submit"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">下达指令</span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center px-4 pt-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/45 px-3 py-1 text-[11px] font-medium text-slate-500 backdrop-blur-xl">
                <AlertTriangle className="h-3 w-3 text-[#c27415]" />
                禁止上传含有乘客 PII 的未脱敏数据
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  isOpen,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  isOpen: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3.5 rounded-lg border px-3 py-2.5 text-left transition ${
        active
          ? "border-white bg-white/75 font-semibold text-[#0f5f57] shadow-[0_2px_10px_rgba(38,77,80,0.06)]"
          : "border-transparent text-slate-600 hover:border-white/70 hover:bg-white/55 hover:text-slate-900"
      } ${!isOpen ? "justify-center" : ""}`}
      title={!isOpen ? label : undefined}
      type="button"
    >
      <span className={active ? "scale-110 transition-transform" : "transition-transform"}>{icon}</span>
      {isOpen && <span className="whitespace-nowrap text-[13px]">{label}</span>}
    </button>
  );
}

function GlassCard({
  title,
  desc,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      className="group relative flex min-h-[150px] flex-col items-start overflow-hidden rounded-lg border border-white/70 bg-white/45 p-5 text-left shadow-[0_16px_46px_rgba(38,77,80,0.07)] backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white/60 disabled:hover:translate-y-0"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="relative z-10 mb-5 rounded-lg border border-white bg-white/80 p-3 shadow-sm transition group-hover:scale-105">
        {icon}
      </div>
      <h3 className="relative z-10 mb-2 text-[17px] font-bold tracking-tight text-slate-800">{title}</h3>
      <p className="relative z-10 text-[13px] font-medium leading-relaxed text-slate-600">{desc}</p>
    </button>
  );
}

function AdminPanel({
  agents,
  dialogueTurns,
  exportConversation,
  messages,
  resetConversation,
  stats,
}: {
  agents: PixelAgent[];
  dialogueTurns: DialogueTurn[];
  exportConversation: () => void;
  messages: ChatItem[];
  resetConversation: () => void;
  stats: Array<{ label: string; value: number }>;
}) {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5">
      <div className="grid gap-5">
        <div className="rounded-lg border border-white/70 bg-white/50 p-4 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl">
          <PixelOfficeStage agents={agents} />
        </div>

        <div className="grid gap-5">
          <div className="rounded-lg border border-white/70 bg-white/50 p-5 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9b3552]">Admin Console</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-800">对话管理</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              这里只对管理员显示。当前版本管理的是本浏览器演示会话里的全部问答记录、资料引用和像素代理状态。
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {stats.map((item) => (
                <div className="rounded-lg border border-white/70 bg-white/60 p-3 shadow-sm" key={item.label}>
                  <b className="block text-2xl font-extrabold text-[#0f5f57]">{item.value}</b>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-white/70 bg-white/50 p-4 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl sm:grid-cols-2">
            <button
              className="rounded-lg border border-[#0f5f57]/20 bg-white/65 px-4 py-3 text-sm font-bold text-[#0f5f57] shadow-sm transition hover:bg-white"
              onClick={exportConversation}
              type="button"
            >
              导出当前对话 JSON
            </button>
            <button
              className="rounded-lg border border-[#9b3552]/20 bg-white/65 px-4 py-3 text-sm font-bold text-[#9b3552] shadow-sm transition hover:bg-white"
              onClick={resetConversation}
              type="button"
            >
              清空当前会话
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-lg border border-white/70 bg-white/50 p-4 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-800">所有对话轮次</h2>
            <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-500">
              {dialogueTurns.length} 条
            </span>
          </div>
          <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
            {dialogueTurns.length === 0 ? (
              <div className="rounded-lg border border-white/70 bg-white/65 p-4 text-sm text-slate-500">还没有用户提问。</div>
            ) : (
              dialogueTurns.map((turn, index) => (
                <article className="rounded-lg border border-white/70 bg-white/65 p-3 shadow-sm" key={turn.id}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <b className="text-sm text-slate-800">#{index + 1}</b>
                    <span className="text-xs font-semibold text-slate-500">
                      {turn.sources.length} 资料 · {turn.graphItems.length} 图谱
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold leading-6 text-[#0f5f57]">{turn.question}</p>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{turn.answer || "等待模型回答"}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/70 bg-white/50 p-4 shadow-[0_16px_46px_rgba(38,77,80,0.08)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-800">消息明细</h2>
            <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-500">
              {messages.length} 条
            </span>
          </div>
          <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div className="rounded-lg border border-white/70 bg-white/65 p-3 shadow-sm" key={message.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <b className="text-xs font-bold uppercase tracking-widest text-[#176b8c]">{message.role}</b>
                  <span className="text-xs font-semibold text-slate-400">{message.id}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.content}</p>
                {Boolean((message.sources?.length || 0) + (message.graphItems?.length || 0)) && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    参考资料 {message.sources?.length || 0} · 图谱线索 {message.graphItems?.length || 0}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function PixelOffice({ agents }: { agents: PixelAgent[] }) {
  return (
    <section className="grid gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#9b3552]">Pixel Agents</p>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">archive 工作台</h2>
      </div>
      <div className="pixel-office">
        <div className="pixel-wall">
          <img src="/pixel-agents/furniture/WHITEBOARD/WHITEBOARD.png" alt="" />
          <b>Archive Run</b>
        </div>
        <div className="agent-row">
          {agents.map((agent, index) => (
            <article className={`agent-station ${agent.active ? "active" : ""}`} key={agent.name}>
              <div className="agent-desk">
                <img className="desk" src="/pixel-agents/furniture/DESK/DESK_FRONT.png" alt="" />
                <img className="pc" src="/pixel-agents/furniture/PC/PC_FRONT_ON_1.png" alt="" />
                <span
                  aria-hidden="true"
                  className={`pixel-agent-sprite row-${index}`}
                  style={{ backgroundImage: `url(${agent.sprite})` }}
                />
              </div>
              <div className="agent-card">
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
                <small>{agent.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

void PixelOffice;

function LegacyPixelOfficeStage({ agents }: { agents: PixelAgent[] }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9b3552]">Pixel Agents</p>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800">archive 像素工作台</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            这里直接按原仓库的官方像素办公室场景来展示，先守住画面比例和像素完整，再叠加当前会话状态。
          </p>
        </div>
        <img alt="苏州地铁" className="h-10 w-auto object-contain sm:h-12" src={BRANDING.full} />
      </div>

      <div className="pixel-reference-shell">
        <div className="pixel-reference-banner-wrap">
          <img alt="Pixel Agents" className="pixel-reference-banner" src={PIXEL_REFERENCE.banner} />
        </div>

        <div className="pixel-reference-stage">
          <img
            alt="Pixel Agents 官方像素办公室场景"
            className="pixel-reference-image"
            src={PIXEL_REFERENCE.office}
          />
          <div className="pixel-reference-badge pixel-reference-badge-left">官方仓库场景</div>
          <div className="pixel-reference-badge pixel-reference-badge-right">固定比例展示</div>
        </div>

        <div className="pixel-reference-grid">
          {agents.map((agent, index) => (
            <article className={`pixel-reference-agent ${agent.active ? "active" : ""}`} key={agent.name}>
              <div className="pixel-reference-avatar-wrap">
                <span
                  aria-hidden="true"
                  className={`pixel-reference-avatar row-${index}`}
                  style={{ backgroundImage: `url(${agent.sprite})` }}
                />
              </div>

              <div className="min-w-0">
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
                <small>{agent.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

void LegacyPixelOfficeStage;

function RepoScreenshotStage({ agents }: { agents: PixelAgent[] }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9b3552]">Pixel Agents</p>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800">仓库原始截图</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            这里直接展示 `pablodelucca/pixel-agents` 仓库里的 `Screenshot.jpg`，不再额外拼接工作台。
          </p>
        </div>
        <img alt="苏州地铁" className="h-10 w-auto object-contain sm:h-12" src={BRANDING.full} />
      </div>

      <div className="pixel-reference-shell">
        <div className="pixel-reference-stage">
          <img alt="Pixel Agents repository screenshot" className="pixel-reference-image" src={PIXEL_REFERENCE.office} />
        </div>

        <div className="pixel-reference-grid">
          {agents.map((agent, index) => (
            <article className={`pixel-reference-agent ${agent.active ? "active" : ""}`} key={agent.name}>
              <div className="pixel-reference-avatar-wrap">
                <span
                  aria-hidden="true"
                  className={`pixel-reference-avatar row-${index}`}
                  style={{ backgroundImage: `url(${agent.sprite})` }}
                />
              </div>
              <div className="min-w-0">
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
                <small>{agent.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

void RepoScreenshotStage;

function PixelOfficeStage({ agents }: { agents: PixelAgent[] }) {
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [layoutError, setLayoutError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(OFFICE_LAYOUT_URL)
      .then((response) => readJson<OfficeLayout>(response))
      .then((data) => {
        if (!active) {
          return;
        }
        setLayout(data);
        setLayoutError("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setLayoutError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, []);

  const officeFurniture = useMemo(() => {
    if (!layout) {
      return [];
    }

    return layout.furniture
      .map((item) => {
        const asset = OFFICE_FURNITURE[item.type];
        if (!asset) {
          return null;
        }

        return {
          ...item,
          asset,
          topTiles: item.row - asset.height / 16 + 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [layout]);

  const agentSlots = useMemo(
    () => (layout ? deriveAgentSlotsFromLayout(layout) : OFFICE_AGENT_SLOTS),
    [layout],
  );

  function resolveAgentPose(agent: PixelAgent, slot: (typeof agentSlots)[number]) {
    const fromDesk = agent.location === "desk";
    const toDesk = agent.destination === "desk";
    const fromCol = fromDesk ? slot.workCol : slot.idleCol;
    const fromRow = fromDesk ? slot.workRow : slot.idleRow;
    const toCol = toDesk ? slot.workCol : slot.idleCol;
    const toRow = toDesk ? slot.workRow : slot.idleRow;
    const targetCol = agent.location !== agent.destination ? toCol : fromCol;
    const targetRow = agent.location !== agent.destination ? toRow : fromRow;

    if (agent.animation === "walk") {
      const dc = toCol - fromCol;
      const dr = toRow - fromRow;
      if (Math.abs(dc) >= Math.abs(dr) && dc !== 0) {
        return {
          col: targetCol,
          row: targetRow,
          direction: "right" as const,
          mirrored: dc < 0,
        };
      }
      return {
        col: targetCol,
        row: targetRow,
        direction: dr < 0 ? "up" : "down",
        mirrored: false,
      };
    }

    return {
      col: targetCol,
      row: targetRow,
      direction: fromDesk ? slot.workDirection : slot.idleDirection,
      mirrored: fromDesk ? slot.workMirrored : slot.idleMirrored,
    };
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9b3552]">Pixel Agents</p>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800">archive pixel office</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Uses the original `default-layout-1.json` coordinates and furniture assets so the admin page shows a stable office layout instead of a guessed mockup.
          </p>
        </div>
        <div className="rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm">
          <img alt="Suzhou Metro" className="h-8 w-auto object-contain sm:h-10" src={BRANDING.full} />
        </div>
      </div>

      <div className="office-stage-shell">
        <div className="office-stage-meta">
          <span>layout: default-layout-1.json</span>
          <span>pixel assets: original repo</span>
        </div>

        {layout ? (
          <div
            className="office-stage"
            style={{
              width: `calc(${layout.cols} * var(--office-tile))`,
              height: `calc(${layout.rows} * var(--office-tile))`,
            }}
          >
            <div
              className="office-tiles"
              style={{ gridTemplateColumns: `repeat(${layout.cols}, var(--office-tile))` }}
            >
              {layout.tiles.map((tile, index) => (
                <span
                  className={`office-tile office-tile-${tile === 255 ? "void" : tile}`}
                  key={`tile-${index}`}
                  style={{ backgroundColor: OFFICE_TILE_COLORS[tile] || "#20283a" }}
                />
              ))}
            </div>

            <div className="office-furniture-layer">
              {officeFurniture.map((item) => (
                <img
                  alt=""
                  aria-hidden="true"
                  className="office-furniture"
                  key={item.uid}
                  src={item.asset.src}
                  style={{
                    left: `calc(${item.col} * var(--office-tile))`,
                    top: `calc(${item.topTiles} * var(--office-tile))`,
                    width: `calc(${item.asset.width / 16} * var(--office-tile))`,
                    height: `calc(${item.asset.height / 16} * var(--office-tile))`,
                    zIndex: item.row * 10,
                    transform: item.asset.mirror ? "scaleX(-1)" : undefined,
                  }}
                />
              ))}
            </div>

            <div className="office-agent-layer">
              {agents.map((agent, index) => {
                const slot = agentSlots[index] || agentSlots[agentSlots.length - 1];
                const isWalking = agent.animation === "walk";
                const pose = resolveAgentPose(agent, slot);
                return (
                  <div
                    className={`office-agent ${agent.active ? "active" : ""} ${isWalking ? "moving" : ""}`}
                    key={agent.name}
                    style={{
                      left: `calc(${pose.col} * var(--office-tile))`,
                      top: `calc(${pose.row} * var(--office-tile))`,
                      zIndex: (pose.row + 2) * 10,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={`office-agent-sprite dir-${pose.direction} state-${agent.animation} ${pose.mirrored ? "mirrored" : ""}`}
                      style={{ backgroundImage: `url(${agent.sprite})` }}
                    />
                    {agent.bubble === "waiting" && <span className="office-agent-bubble">...</span>}
                    <span className="office-agent-dot" />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="office-stage-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{layoutError || "Loading pixel office..."}</span>
          </div>
        )}

        <div className="office-agent-grid">
          {agents.map((agent, index) => {
            const slot = agentSlots[index] || agentSlots[agentSlots.length - 1];
            const pose = resolveAgentPose(agent, slot);
            return (
              <article className={`office-agent-card ${agent.active ? "active" : ""}`} key={agent.name}>
                <div className="office-agent-avatar-wrap">
                  <span
                    aria-hidden="true"
                    className={`office-agent-avatar dir-${pose.direction} state-${agent.animation} ${pose.mirrored ? "mirrored" : ""}`}
                    style={{ backgroundImage: `url(${agent.sprite})` }}
                  />
                </div>
                <div className="min-w-0">
                  <strong>{agent.name}</strong>
                  <span>{agent.role}</span>
                  <small>{agent.detail}</small>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatItem }) {
  const isUser = message.role === "user";
  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-3xl rounded-lg border p-4 shadow-sm ${
          isUser ? "border-[#0f5f57]/25 bg-[#e7f4f0]" : "border-white/70 bg-white/70"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{message.content}</p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-slate-200/70 pt-3">
            <strong className="text-xs text-[#0f5f57]">参考资料</strong>
            {message.sources.map((source) => (
              <div className="rounded-lg border border-slate-200/70 bg-white/70 p-3 text-xs" key={`${message.id}-${source.id}`}>
                <b className="block text-slate-800">{source.title}</b>
                <small className="mt-1 block leading-5 text-slate-500">{source.excerpt}</small>
              </div>
            ))}
          </div>
        )}
        {message.graphItems && message.graphItems.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-slate-200/70 pt-3">
            <strong className="inline-flex items-center gap-1 text-xs text-[#176b8c]">
              <Network className="h-3.5 w-3.5" />
              知识图谱线索
            </strong>
            {message.graphItems.map((item) => (
              <div className="rounded-lg border border-[#176b8c]/15 bg-white/70 p-3 text-xs" key={`${message.id}-${item.id}`}>
                <b className="block text-slate-800">{item.title}</b>
                <small className="mt-1 block leading-5 text-slate-500">
                  {item.type} · {item.excerpt}
                </small>
              </div>
            ))}
          </div>
        )}
        {message.durationMs && <em className="mt-3 block text-xs not-italic text-slate-500">用时 {formatDuration(message.durationMs)}</em>}
      </div>
    </article>
  );
}
