import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";

type ArchiveAction = "build" | "warm" | "search" | "inspect" | "help";

type ArchiveParams = {
  action: ArchiveAction;
  pathText?: string;
  query?: string;
  limit?: number;
};

type ArchiveModule = {
  runArchiveAction: (params: ArchiveParams) => Promise<string>;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type UserChatMessage = {
  role: "user";
  content: string;
};

type ModelConfig = {
  url?: string;
  apiKey?: string;
  model?: string;
  displayName: string;
};

type SourceItem = {
  id: string;
  title: string;
  excerpt: string;
};

type GraphNode = {
  id: string;
  node_type: string;
  name: string;
  score?: number;
  degree?: number;
  attrs?: Record<string, unknown>;
};

type GraphSourceItem = {
  id: string;
  title: string;
  type: string;
  excerpt: string;
  score?: number;
};

type GraphStatus = {
  ready: boolean;
  documentCount?: number;
  nodeCount?: number;
  edgeCount?: number;
  error?: string;
};

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(serverDir, "..");
const workspaceRoot = path.resolve(appRoot, "..", "..");

dotenv.config({ path: path.join(appRoot, ".env.local"), override: false, quiet: true });
dotenv.config({ path: path.join(appRoot, ".env"), override: false, quiet: true });

const workstationRoot = path.join(workspaceRoot, "workstation_143");
const archiveModulePath = path.join(
  workstationRoot,
  "clawbot",
  "local-plugins",
  "workstation143",
  "src",
  "archive.ts",
);
const officeArchiveScriptPath = path.join(
  workstationRoot,
  "clawbot",
  "skills",
  "folder-intel",
  "scripts",
  "office_archive.py",
);
const kbConfigPath = path.join(
  workstationRoot,
  "knowledge_base",
  "知识库交付包_20260403",
  "config.yaml",
);
const archiveOutputsRoot = path.join(workstationRoot, "deliverables", "archive_outputs");
const kbApiBaseUrl = process.env.KB_API_URL || "http://127.0.0.1:8001";

let archiveModulePromise: Promise<ArchiveModule> | null = null;

function getLanIpv4(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.")) {
        return entry.address;
      }
    }
  }
  return undefined;
}

function readPort(): number {
  const raw = Number(process.env.PORT || 3000);
  return Number.isFinite(raw) && raw > 0 ? raw : 3000;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readLimit(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

function clipText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

const TOPIC_SUFFIXES = ["制度", "系统", "规程", "周期", "办法", "要求", "资料", "材料", "标准", "规范"];

function stripTopicSuffix(value: string): string {
  for (const suffix of TOPIC_SUFFIXES) {
    if (value.endsWith(suffix) && value.length > suffix.length + 1) {
      return value.slice(0, -suffix.length);
    }
  }
  return value;
}

function extractKeywordGroups(question: string): string[][] {
  const normalized = question
    .toUpperCase()
    .replace(/[？?！!，,。、“”"（）()《》【】[\]:：;；]/g, " ")
    .replace(/具体含义|含义|具体|有哪些|是什么|什么|主要|相关|资料|材料|说明|介绍|情况|请问|一下|有关|之间|关联/g, " ")
    .replace(/[和与及]/g, "|");

  return normalized
    .split(/[|\s]+/)
    .filter(Boolean)
    .map((chunk) => {
      const variants = new Set<string>();
      if (chunk.length >= 2 && !TOPIC_SUFFIXES.includes(chunk)) {
        variants.add(chunk);
        const strippedChunk = stripTopicSuffix(chunk);
        if (strippedChunk !== chunk) {
          variants.add(strippedChunk);
        }
      }
      const asciiParts = chunk.match(/[A-Z0-9_-]{2,}/g) || [];
      const chineseParts = chunk.match(/[\u4e00-\u9fa5]{2,}/g) || [];
      for (const part of [...asciiParts, ...chineseParts]) {
        if (TOPIC_SUFFIXES.includes(part)) {
          continue;
        }
        variants.add(part);
        const stripped = stripTopicSuffix(part);
        if (stripped !== part) {
          variants.add(stripped);
        }
      }
      return [...variants];
    })
    .filter((group) => group.length > 0)
    .slice(0, 4);
}

function flattenKeywordGroups(groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}

function countKeywordGroupMatches(text: string, groups: string[][]): number {
  const normalized = text.toUpperCase();
  return groups.filter((group) => group.some((keyword) => normalized.includes(keyword))).length;
}

function scoreByKeywords(text: string, keywords: string[]): number {
  if (!keywords.length) {
    return 0;
  }
  const normalized = text.toUpperCase();
  return keywords.reduce((score, keyword) => {
    if (!normalized.includes(keyword)) {
      return score;
    }
    return score + Math.max(2, Math.min(keyword.length, 8));
  }, 0);
}

function readSectionValue(yamlText: string, section: string, key: string): string | undefined {
  const lines = yamlText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${section}:`);
  if (start < 0) {
    return undefined;
  }

  const sectionLines: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line && !/^\s/.test(line)) {
      break;
    }
    sectionLines.push(line);
  }

  const keyMatch = new RegExp(`^\\s+${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\r\\n#]+))`, "m").exec(
    sectionLines.join("\n"),
  );
  const value = keyMatch?.[1] ?? keyMatch?.[2] ?? keyMatch?.[3];
  return value?.trim() || undefined;
}

function loadModelConfig(): ModelConfig {
  let configText = "";
  if (fs.existsSync(kbConfigPath)) {
    configText = fs.readFileSync(kbConfigPath, "utf8");
  }

  return {
    url: process.env.ARCHIVE_UI_LLM_URL || readSectionValue(configText, "hyde", "llm_url"),
    apiKey: process.env.ARCHIVE_UI_LLM_KEY || readSectionValue(configText, "hyde", "llm_api_key"),
    model: process.env.ARCHIVE_UI_LLM_MODEL || readSectionValue(configText, "hyde", "model"),
    displayName: process.env.ARCHIVE_UI_MODEL_NAME || "内网问答模型",
  };
}

function normalizeMessages(value: unknown): UserChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const role = (item as Record<string, unknown>).role;
      const content = readString((item as Record<string, unknown>).content);
      if (role !== "user" || !content) {
        return null;
      }
      return { role, content: clipText(content, 1200) } satisfies UserChatMessage;
    })
    .filter((item): item is UserChatMessage => Boolean(item))
    .slice(-8);
}

function sanitizeTitle(value: string): string {
  return clipText(
    value
      .replace(/Q\/SZGY[\w\s.-]+/gi, "相关规程")
      .replace(/\b(openclaw|pptx|docx|xlsx|pdf|slide)\b/gi, "")
      .replace(/\.(docx|xlsx|pptx|pdf|md|txt)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    34,
  );
}

function cleanArchiveSnippet(value: string): string {
  return clipText(
    value
      .replace(/^Excerpt:\s*/i, "")
      .replace(/Source:\s*.*?(?=Evidence source:|Summary:|Excerpt:|$)/gi, "")
      .replace(/Evidence source:\s*.*?(?=Summary:|Excerpt:|$)/gi, "")
      .replace(/Summary:\s*/gi, "")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\*\*/g, "")
      .replace(/^[-–—]{3,}$/gm, "")
      .replace(/Q\/SZGY[\w\s.-]+/gi, "相关规程")
      .replace(/(?:\[object Object\],?\s*)+/g, "")
      .replace(/\b(openclaw|pptx|docx|xlsx|pdf|slide|agenda|insight)\b/gi, "")
      .replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/g, "")
      .replace(/\s*\|\s*/g, "；")
      .replace(/；{2,}/g, "；")
      .replace(/\s+/g, " ")
      .replace(/^；|；$/g, "")
      .trim(),
    320,
  );
}

function cleanModelAnswer(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function rankArchiveSources(question: string, sources: SourceItem[]): SourceItem[] {
  const keywordGroups = extractKeywordGroups(question);
  const keywords = flattenKeywordGroups(keywordGroups);
  if (!keywords.length) {
    return sources.slice(0, 5);
  }

  const requiresJointMatch = keywordGroups.length > 1;

  return sources
    .map((source) => {
      const titleScore = scoreByKeywords(source.title, keywords) * 2;
      const excerptScore = scoreByKeywords(source.excerpt, keywords);
      const groupMatches = countKeywordGroupMatches(`${source.title}\n${source.excerpt}`, keywordGroups);
      return {
        source,
        groupMatches,
        score: titleScore + excerptScore,
      };
    })
    .filter((item) => item.score > 0 && item.groupMatches >= (requiresJointMatch ? 2 : 1))
    .sort((a, b) => b.groupMatches - a.groupMatches || b.score - a.score)
    .slice(0, 5)
    .map((item, index) => ({
      ...item.source,
      id: `资料${index + 1}`,
    }));
}

function rankGraphItems(question: string, items: GraphSourceItem[]): GraphSourceItem[] {
  const keywordGroups = extractKeywordGroups(question);
  const keywords = flattenKeywordGroups(keywordGroups);
  if (!keywords.length) {
    return items.slice(0, 5);
  }

  const requiresJointMatch = keywordGroups.length > 1;

  return items
    .map((item) => ({
      item,
      groupMatches: countKeywordGroupMatches(`${item.title}\n${item.type}\n${item.excerpt}`, keywordGroups),
      score: scoreByKeywords(`${item.title}\n${item.type}\n${item.excerpt}`, keywords),
    }))
    .filter((item) => item.score > 0 && item.groupMatches >= (requiresJointMatch ? 2 : 1))
    .sort((a, b) => b.groupMatches - a.groupMatches || b.score - a.score)
    .slice(0, 5)
    .map((item, index) => ({
      ...item.item,
      id: `图谱${index + 1}`,
    }));
}

function graphTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    document: "文档",
    policy: "制度",
    concept: "概念",
    system: "系统",
    org_unit: "组织",
    reference: "引用",
    line: "线路",
    company: "公司",
    department: "部门",
    category: "分类",
  };
  return labels[value] || value || "节点";
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function fetchKbJson<T>(apiPath: string, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(apiPath, kbApiBaseUrl), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`知识库接口返回 ${response.status}：${clipText(text, 180)}`);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function getGraphStatus(): Promise<GraphStatus> {
  try {
    const health = await fetchKbJson<{
      status?: string;
      document_count?: number;
      node_count?: number;
      edge_count?: number;
    }>("/graph/health", 2500);
    return {
      ready: health.status === "ready",
      documentCount: readNumber(health.document_count),
      nodeCount: readNumber(health.node_count),
      edgeCount: readNumber(health.edge_count),
    };
  } catch (error) {
    return {
      ready: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function compactGraphNode(item: GraphNode, index: number): GraphSourceItem {
  const attrs = item.attrs || {};
  const fields = [
    graphTypeLabel(item.node_type),
    readString(attrs.company) || readString(attrs.department) || readString(attrs.category),
    item.degree ? `关联 ${item.degree}` : undefined,
  ].filter(Boolean);
  return {
    id: `图谱${index + 1}`,
    title: sanitizeTitle(item.name),
    type: graphTypeLabel(item.node_type),
    excerpt: fields.join("；") || "知识图谱返回的关联节点。",
    score: item.score,
  };
}

async function searchGraph(query: string, limit = 5): Promise<GraphSourceItem[]> {
  const normalizedLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const url = new URL("/graph/search", kbApiBaseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(normalizedLimit));
  try {
    const payload = await fetchKbJson<{ items?: GraphNode[] }>(`${url.pathname}${url.search}`, 8000);
    return (payload.items || []).slice(0, normalizedLimit).map(compactGraphNode);
  } catch {
    return [];
  }
}

function parseArchiveSources(text: string, question = ""): SourceItem[] {
  const inspectedText = text.includes("Inspected evidence:")
    ? text.split("Inspected evidence:")[1] || ""
    : text;
  const questionKeywords = flattenKeywordGroups(extractKeywordGroups(question));

  const sections = inspectedText
    .split(/\n(?=\d+\.\s+)/)
    .map((item) => item.trim())
    .filter((item) => /^\d+\.\s+/.test(item));

  const parsed = sections.map((section) => {
    const lines = section.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const title = sanitizeTitle(lines[0]?.replace(/^\d+\.\s+/, "") || "资料");
    const excerptIndex = lines.findIndex((line) => /^Excerpt:\s*/i.test(line));
    const excerptLines = excerptIndex >= 0
      ? lines
        .slice(excerptIndex)
        .filter((line, index) => {
          if (index === 0) {
            return true;
          }
          return !/^(Focused row evidence:|Exact evidence found|Markdown fallback checked|Extraction incomplete|Instruction:|Source:|Evidence source:|Summary:)/i.test(line);
        })
        .slice(0, 6)
      : [];
    const focusedIndex = lines.findIndex((line) => /^Focused row evidence:/i.test(line));
    const focusedLines = focusedIndex >= 0
      ? lines
        .slice(focusedIndex + 1)
        .filter((line) => !/^(Exact evidence found|Markdown fallback checked|Extraction incomplete|Instruction:)/i.test(line))
        .slice(0, 3)
        .map((line) => line.replace(/^-+\s*/, ""))
      : [];
    const excerptLine = lines.find((line) => /^Excerpt:\s*/i.test(line));
    const snippetCandidates = [
      focusedLines.join(" "),
      excerptLines.join(" ") || excerptLine || "",
      lines.slice(1).join(" "),
    ]
      .map((item) => item.trim())
      .filter(Boolean);
    const bestSnippet = snippetCandidates.sort((left, right) => {
      const rightScore = scoreByKeywords(right, questionKeywords);
      const leftScore = scoreByKeywords(left, questionKeywords);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.length - left.length;
    })[0] || "";
    const excerpt = cleanArchiveSnippet(bestSnippet);
    return {
      title,
      excerpt: excerpt || "检索结果未提供摘录，需要打开原文核验。",
    };
  });

  const deduped = parsed.filter((item, index) => {
    return parsed.findIndex((candidate) => candidate.title === item.title && candidate.excerpt === item.excerpt) === index;
  });

  return deduped.slice(0, 5).map((item, index) => ({
    id: `资料${index + 1}`,
    title: item.title,
    excerpt: item.excerpt,
  }));
}

function listMarkdownFiles(root: string, limit = 800): string[] {
  if (!fs.existsSync(root) || limit <= 0) {
    return [];
  }

  const results: string[] = [];
  const stack = [root];
  while (stack.length > 0 && results.length < limit) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && /\.md$/i.test(entry.name)) {
        results.push(fullPath);
        if (results.length >= limit) {
          break;
        }
      }
    }
  }
  return results;
}

function titleFromMarkdown(filePath: string, content: string): string {
  const heading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line.trim()));
  return sanitizeTitle(heading?.replace(/^#\s+/, "") || path.basename(filePath, path.extname(filePath)));
}

function searchSupplementalMarkdown(question: string, limit = 4): SourceItem[] {
  const keywordGroups = extractKeywordGroups(question);
  const keywords = flattenKeywordGroups(keywordGroups);
  if (!keywords.length) {
    return [];
  }
  const requiresJointMatch = keywordGroups.length > 1;

  return listMarkdownFiles(archiveOutputsRoot)
    .map((filePath) => {
      let content = "";
      try {
        content = fs.readFileSync(filePath, "utf8");
      } catch {
        return null;
      }

      const title = titleFromMarkdown(filePath, content);
      const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const matchingIndexes = lines
        .map((line, index) => ({ line, index, score: scoreByKeywords(line, keywords) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((item) => item.index);
      const snippet = matchingIndexes
        .flatMap((index) => lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 4)))
        .filter((line, index, array) => array.indexOf(line) === index)
        .join(" ");
      const groupMatches = countKeywordGroupMatches(`${title}\n${snippet}`, keywordGroups);
      const score = scoreByKeywords(`${title}\n${snippet}`, keywords) + groupMatches * 10;
      if (score <= 0 || groupMatches < (requiresJointMatch ? 2 : 1)) {
        return null;
      }

      return {
        id: "补充资料",
        title,
        excerpt: cleanArchiveSnippet(snippet),
        score,
      };
    })
    .filter((item): item is SourceItem & { score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, index) => ({
      id: `资料${index + 1}`,
      title: item.title,
      excerpt: item.excerpt,
    }));
}

function extractArchiveHighlights(question: string, archiveText: string): string[] {
  const keywordGroups = extractKeywordGroups(question);
  const keywords = flattenKeywordGroups(keywordGroups);
  if (!keywords.length) {
    return [];
  }

  const fragments = archiveText
    .split(/\r?\n+/)
    .flatMap((line) => line.split(/(?<=[。；;])/))
    .map((item) => item.trim())
    .filter((item) => item.length >= 12)
    .map((item) => ({
      text: cleanArchiveSnippet(item),
      score: scoreByKeywords(item, keywords) + countKeywordGroupMatches(item, keywordGroups) * 6,
    }))
    .filter((item) => item.score > 0);

  const deduped = fragments.filter((item, index) => {
    return fragments.findIndex((candidate) => candidate.text === item.text) === index;
  });

  return deduped
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
    .slice(0, 4)
    .map((item) => item.text);
}

function buildAnswerPrompt(
  question: string,
  sources: SourceItem[],
  archiveText: string,
  graphItems: GraphSourceItem[],
): string {
  const archiveHighlights = extractArchiveHighlights(question, archiveText);
  const evidence = sources.length > 0
    ? sources.map((source) => `【${source.id}】${source.title}\n摘录：${source.excerpt}`).join("\n\n")
    : "本次检索没有找到明确资料。";
  const highlightEvidence = sources.length > 0 && archiveHighlights.length > 0
    ? archiveHighlights.map((item, index) => `【证据片段${index + 1}】${item}`).join("\n\n")
    : "本次没有抽取出可直接作答的原文片段。";
  const graphEvidence = graphItems.length > 0
    ? graphItems.map((item) => `【${item.id}】${item.title}\n类型：${item.type}；${item.excerpt}`).join("\n\n")
    : "本次没有返回可用的知识图谱线索。";

  return [
    `用户问题：${question}`,
    "",
    "已检索到的本地档案资料：",
    evidence,
    "",
    "从原始档案里截出的高相关片段（优先参考这里的明确表述）：",
    highlightEvidence,
    "",
    "知识图谱线索（只用于识别相关制度、系统、部门或关联资料，不替代原文依据）：",
    graphEvidence,
    "",
    "请用中文回答。要求：",
    "1. 像同事解释事情一样说人话，不要输出工具过程。",
    "2. 只根据上面的本地档案资料回答；资料不够就直接说没查到足够依据。",
    "3. 不要展示完整文件路径，不要展示很长的文件名。",
    "4. 涉及依据时，用【资料1】这种格式标注来源。",
    "5. 图谱线索只能作为关联提示；如果本地档案资料为空，不得根据图谱线索直接作答，只能说明未查到足够依据。",
    "6. 如果证据片段里已经出现明确条款、周期、频次、条件或范围，要优先直接引用这些内容来回答。",
    "7. 不要使用 Markdown，不要加粗，不要输出英文界面词。",
    "8. 结尾给一句“还需要核验原文的点”，没有就写“暂无”。",
  ].join("\n");
}

async function loadArchiveModule(): Promise<ArchiveModule> {
  if (!archiveModulePromise) {
    archiveModulePromise = import(pathToFileURL(archiveModulePath).href).then((module) => {
      const loaded = module as Partial<ArchiveModule>;
      if (typeof loaded.runArchiveAction !== "function") {
        throw new Error(`没有找到档案检索函数：${archiveModulePath}`);
      }
      return loaded as ArchiveModule;
    });
  }
  return archiveModulePromise;
}

async function runArchive(params: ArchiveParams): Promise<string> {
  const archive = await loadArchiveModule();
  return await archive.runArchiveAction(params);
}

async function callModel(config: ModelConfig, messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!config.url || !config.model || !config.apiKey) {
    throw new Error("模型配置不完整。请检查知识库配置或 .env.local。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.15,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`模型接口返回 ${response.status}：${clipText(text, 240)}`);
    }

    const data = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("模型没有返回答案。");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

type ChatStage = "archive:start" | "archive:done" | "graph:start" | "graph:done" | "compose:start";

type ChatResult = {
  ok: true;
  answer: string;
  sources: SourceItem[];
  graphItems: GraphSourceItem[];
  searched: boolean;
  modelName: string;
  durationMs: number;
};

async function runChatPipeline(
  question: string,
  history: Array<{ role: "user"; content: string }>,
  startedAt: number,
  onStage?: (stage: ChatStage) => void,
): Promise<ChatResult> {
  const model = loadModelConfig();
  const graphStatus = await getGraphStatus();

  onStage?.("archive:start");
  const archiveText = await runArchive({ action: "search", query: question, limit: 5 });
  onStage?.("archive:done");

  let rawGraphItems: GraphSourceItem[] = [];
  if (graphStatus.ready) {
    onStage?.("graph:start");
    rawGraphItems = await searchGraph(question, 5);
    onStage?.("graph:done");
  }

  const sources = rankArchiveSources(question, [
    ...searchSupplementalMarkdown(question, 5),
    ...parseArchiveSources(archiveText, question),
  ]);
  const graphItems = rankGraphItems(question, rawGraphItems);
  const prompt = buildAnswerPrompt(question, sources, archiveText, graphItems);

  onStage?.("compose:start");
  const answer = cleanModelAnswer(
    await callModel(model, [
      {
        role: "system",
        content: [
          "浣犳槸鏈湴妗ｆ闂瓟鍔╂墜銆?",
          "浣犵殑鍥炵瓟蹇呴』鏄腑鏂囥€?",
          "浣犺鎶婃绱㈠埌鐨勮祫鏂欒浆鎴愭竻妤氥€佸彲鎵ц鐨勫洖绛斻€?",
          "涓嶈杈撳嚭鑻辨枃鐣岄潰璇嶃€佷唬鐮佸潡銆佸畬鏁磋矾寰勬垨鍐呴儴宸ュ叿鍚嶇О銆?",
          "鍘嗗彶瀵硅瘽鍙敤浜庣悊瑙ｄ笂涓嬫枃锛屼笉绠楄瘉鎹€?",
        ].join("\n"),
      },
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: prompt },
    ]),
  );

  return {
    ok: true,
    answer,
    sources,
    graphItems,
    searched: sources.length > 0,
    modelName: model.displayName,
    durationMs: Date.now() - startedAt,
  };
}

function createApiRouter(): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: "4mb" }));

  router.get("/health", async (_req, res) => {
    const graph = await getGraphStatus();
    res.json({
      ok: true,
      archiveModuleFound: fs.existsSync(archiveModulePath),
      officeArchiveScriptFound: fs.existsSync(officeArchiveScriptPath),
      modelConfigured: Boolean(loadModelConfig().url && loadModelConfig().apiKey && loadModelConfig().model),
      graphReady: graph.ready,
      graphError: graph.error,
    });
  });

  router.get("/model/status", async (_req, res) => {
    const model = loadModelConfig();
    const graph = await getGraphStatus();
    res.json({
      ok: Boolean(model.url && model.apiKey && model.model && fs.existsSync(archiveModulePath)),
      modelName: model.displayName,
      archiveReady: fs.existsSync(archiveModulePath) && fs.existsSync(officeArchiveScriptPath),
      modelReady: Boolean(model.url && model.apiKey && model.model),
      graphReady: graph.ready,
      graphNodeCount: graph.nodeCount,
      graphEdgeCount: graph.edgeCount,
      abilities: [
        "先查本地档案",
        "再组织中文答案",
        "标出资料来源",
        graph.ready ? "知识图谱辅助关联" : "知识图谱待接入",
      ],
    });
  });

  router.get("/graph/status", async (_req, res) => {
    const graph = await getGraphStatus();
    res.json({ ok: graph.ready, ...graph });
  });

  router.post("/graph/search", async (req, res) => {
    const startedAt = Date.now();
    const query = readString(req.body?.query);
    const limit = readLimit(req.body?.limit) ?? 5;
    if (!query) {
      res.status(400).json({ ok: false, error: "请输入图谱检索词。", durationMs: 0 });
      return;
    }

    const items = await searchGraph(query, limit);
    res.json({
      ok: items.length > 0,
      items,
      durationMs: Date.now() - startedAt,
    });
  });

  router.get("/archive/status", async (_req, res) => {
    const startedAt = Date.now();
    try {
      const text = await runArchive({ action: "inspect" });
      res.json({ ok: true, action: "status", text, durationMs: Date.now() - startedAt });
    } catch (error) {
      res.status(500).json({
        ok: false,
        action: "status",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
    }
  });

  router.post("/chat", async (req, res) => {
    const startedAt = Date.now();
    const question = readString(req.body?.message);
    const history = normalizeMessages(req.body?.history);
    if (!question) {
      res.status(400).json({ ok: false, error: "请输入问题。", durationMs: 0 });
      return;
    }

    try {
      const model = loadModelConfig();
      const [archiveText, rawGraphItems] = await Promise.all([
        runArchive({ action: "search", query: question, limit: 5 }),
        searchGraph(question, 5),
      ]);
      const sources = rankArchiveSources(question, [
        ...searchSupplementalMarkdown(question, 5),
        ...parseArchiveSources(archiveText, question),
      ]);
      const graphItems = rankGraphItems(question, rawGraphItems);
      const prompt = buildAnswerPrompt(question, sources, archiveText, graphItems);
      const answer = cleanModelAnswer(await callModel(model, [
        {
          role: "system",
          content: [
            "你是本地档案问答助手。",
            "你的回答必须是中文。",
            "你要把检索到的资料转成清楚、可执行的回答。",
            "不要输出英文界面词、代码块、完整路径或内部工具名称。",
            "历史对话只用于理解上下文，不算证据。",
          ].join("\n"),
        },
        ...history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: prompt },
      ]));

      res.json({
        ok: true,
        answer,
        sources,
        graphItems,
        searched: sources.length > 0,
        modelName: model.displayName,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
    }
  });

  router.post("/chat/stream", async (req, res) => {
    const startedAt = Date.now();
    const question = readString(req.body?.message);
    const history = normalizeMessages(req.body?.history);
    if (!question) {
      res.status(400).json({ ok: false, error: "璇疯緭鍏ラ棶棰樸€?", durationMs: 0 });
      return;
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      const result = await runChatPipeline(question, history, startedAt, (stage) => {
        writeEvent({ type: "stage", stage, durationMs: Date.now() - startedAt });
      });
      writeEvent({ type: "final", ...result });
      res.end();
    } catch (error) {
      writeEvent({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      res.end();
    }
  });

  router.post("/archive/search", async (req, res) => {
    const startedAt = Date.now();
    const query = readString(req.body?.query);
    const pathText = readString(req.body?.path);
    const limit = readLimit(req.body?.limit) ?? 8;
    if (!query) {
      res.status(400).json({ ok: false, action: "search", error: "请输入检索词。", durationMs: 0 });
      return;
    }

    try {
      const text = await runArchive({ action: "search", pathText, query, limit });
      res.json({ ok: true, action: "search", text, durationMs: Date.now() - startedAt });
    } catch (error) {
      res.status(500).json({
        ok: false,
        action: "search",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
    }
  });

  return router;
}

async function startServer(): Promise<void> {
  const app = express();
  const port = readPort();
  const serveDist = process.env.SERVE_DIST === "true" || process.env.NODE_ENV === "production";

  app.use("/api", createApiRouter());

  if (serveDist) {
    const distDir = path.join(appRoot, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      root: appRoot,
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
        host: "0.0.0.0",
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        const template = await fs.promises.readFile(path.join(appRoot, "index.html"), "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  app.listen(port, "0.0.0.0", () => {
    const lanIp = getLanIpv4();
    console.log(`[archive-qa] http://127.0.0.1:${port}`);
    if (lanIp) {
      console.log(`[archive-qa] http://${lanIp}:${port}`);
    }
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
