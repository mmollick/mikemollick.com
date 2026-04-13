import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

export interface CCStats {
  totalSessions: number;
  totalPrompts: number;
  totalToolCalls: number;
  tokens: {
    input: number;
    output: number;
    cache_creation: number;
    cache_read: number;
  };
  modelBreakdown: Record<string, number>; // model name → session count
  asOf: string; // most recent timestamp_end
}

export interface HeatmapData {
  // ISO date string (YYYY-MM-DD) → cost in USD
  dailyCost: Record<string, number>;
  // ISO date of the earliest day in the dataset
  firstDate: string;
  // ISO date of the latest day in the dataset
  lastDate: string;
  maxCost: number;
}

interface SessionRecord {
  session_id: string;
  timestamp_start: string;
  timestamp_end: string;
  model: string;
  num_prompts: number;
  num_tool_calls: number;
  tokens: {
    input: number;
    output: number;
    cache_creation: number;
    cache_read: number;
  };
  estimated_cost_usd: number;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function getCCStats(): CCStats | null {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filePath = join(__dirname, "../../data/claude-stats/session-stats.jsonl");
    const raw = readFileSync(filePath, "utf-8");

    // Parse all lines, keep latest snapshot per session_id
    const latest = new Map<string, SessionRecord>();
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const record = JSON.parse(trimmed) as SessionRecord;
      const existing = latest.get(record.session_id);
      if (!existing || record.timestamp_end > existing.timestamp_end) {
        latest.set(record.session_id, record);
      }
    }

    // Filter to last 30 days, exclude zero-activity sessions
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = Array.from(latest.values()).filter(
      (s) => s.timestamp_start >= cutoff && s.num_prompts > 0
    );

    if (sessions.length === 0) return null;

    // Aggregate
    const tokens = { input: 0, output: 0, cache_creation: 0, cache_read: 0 };
    const modelBreakdown: Record<string, number> = {};
    let totalPrompts = 0;
    let totalToolCalls = 0;
    let asOf = "";

    for (const s of sessions) {
      tokens.input += s.tokens.input;
      tokens.output += s.tokens.output;
      tokens.cache_creation += s.tokens.cache_creation;
      tokens.cache_read += s.tokens.cache_read;
      totalPrompts += s.num_prompts;
      totalToolCalls += s.num_tool_calls;
      if (s.model) {
        modelBreakdown[s.model] = (modelBreakdown[s.model] ?? 0) + 1;
      }
      if (s.timestamp_end > asOf) asOf = s.timestamp_end;
    }

    return {
      totalSessions: sessions.length,
      totalPrompts,
      totalToolCalls,
      tokens,
      modelBreakdown,
      asOf,
    };
  } catch {
    return null;
  }
}

export function getHeatmapData(): HeatmapData | null {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filePath = join(__dirname, "../../data/claude-stats/session-stats.jsonl");
    const raw = readFileSync(filePath, "utf-8");

    // Deduplicate: keep latest snapshot per session
    const latest = new Map<string, SessionRecord>();
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const record = JSON.parse(trimmed) as SessionRecord;
      const existing = latest.get(record.session_id);
      if (!existing || record.timestamp_end > existing.timestamp_end) {
        latest.set(record.session_id, record);
      }
    }

    const dailyCost: Record<string, number> = {};
    let firstDate = "";
    let lastDate = "";

    for (const s of latest.values()) {
      if (s.num_prompts === 0 || s.estimated_cost_usd === 0) continue;
      const day = s.timestamp_start.slice(0, 10); // YYYY-MM-DD
      dailyCost[day] = (dailyCost[day] ?? 0) + s.estimated_cost_usd;
      if (!firstDate || day < firstDate) firstDate = day;
      if (!lastDate || day > lastDate) lastDate = day;
    }

    if (!firstDate) return null;

    const maxCost = Math.max(...Object.values(dailyCost));
    return { dailyCost, firstDate, lastDate, maxCost };
  } catch {
    return null;
  }
}

export type HeatmapSegment = { text: string; style: "label" | "dot" | "active1" | "active2" | "active3" | "active4" };
export type HeatmapLine = HeatmapSegment[];

/**
 * Build a Unicode heat map matching the `claude /stats` layout:
 * - 53 columns (weeks), rows = Sun..Sat (0=Sun, 6=Sat)
 * - Left-aligned month labels above columns
 * - Day labels (Mon/Wed/Fri) on the left
 */
export function buildHeatmapGrid(
  data: HeatmapData,
  toDate: Date = new Date()
): { lines: HeatmapLine[] } {
  const WEEKS = 53;
  // · for empty, █ for active — color conveys intensity
  const EMPTY = "·";
  const ACTIVE = ["█", "█", "█", "█"] as const;

  // End = Saturday of current week
  const end = new Date(toDate);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  // Start = Sunday of the week 53 weeks before end
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - WEEKS * 7 + 1);

  // Build grid[weekIndex][dowIndex] where dow 0=Sun..6=Sat
  const grid: (string | null)[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cur <= end ? cur.toISOString().slice(0, 10) : null);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    grid.push(week);
  }

  // Quartile bucketing
  const nonZero = Object.values(data.dailyCost).filter((v) => v > 0).sort((a, b) => a - b);
  const q1 = nonZero[Math.floor(nonZero.length * 0.25)] ?? 1;
  const q2 = nonZero[Math.floor(nonZero.length * 0.5)] ?? 2;
  const q3 = nonZero[Math.floor(nonZero.length * 0.75)] ?? 3;

  function bucket(cost: number): number {
    if (cost <= 0) return 0;
    if (cost <= q1) return 1;
    if (cost <= q2) return 2;
    if (cost <= q3) return 3;
    return 4;
  }

  // Month label row
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthRow = new Array<string>(WEEKS).fill(" ");
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const firstDay = grid[w][0];
    if (!firstDay) continue;
    const m = new Date(firstDay).getUTCMonth();
    if (m !== lastMonth) { monthRow[w] = MONTHS[m]; lastMonth = m; }
  }

  const DAY_LABEL_WIDTH = 5;
  const monthEntries: { col: number; label: string }[] = [];
  for (let c = 0; c < WEEKS; c++) {
    if (monthRow[c] !== " ") monthEntries.push({ col: c, label: monthRow[c] });
  }
  let monthLine = " ".repeat(DAY_LABEL_WIDTH);
  for (let i = 0; i < monthEntries.length; i++) {
    const { label } = monthEntries[i];
    const isLast = i === monthEntries.length - 1;
    if (isLast) {
      monthLine += label;
    } else {
      const { col: nextCol } = monthEntries[i + 1];
      const curEnd = monthLine.length - DAY_LABEL_WIDTH;
      const gap = nextCol - curEnd;
      monthLine += (label + " ".repeat(Math.max(1, gap))).slice(0, Math.max(label.length + 1, gap));
    }
  }

  const DAY_LABELS = ["   ", "Mon", "   ", "Wed", "   ", "Fri", "   "];
  const lines: HeatmapLine[] = [];

  lines.push([{ text: monthLine, style: "label" }]);

  for (let d = 0; d < 7; d++) {
    const prefix = `  ${DAY_LABELS[d]} `;
    const line: HeatmapLine = [{ text: prefix, style: "label" }];
    for (let w = 0; w < WEEKS; w++) {
      const dateStr = grid[w][d];
      const cost = dateStr ? (data.dailyCost[dateStr] ?? 0) : 0;
      const b = dateStr ? bucket(cost) : 0;
      const ch = b === 0 ? EMPTY : ACTIVE[b - 1];
      const style: HeatmapSegment["style"] = b === 0 ? "dot" : `active${b}` as HeatmapSegment["style"];
      if (line.length > 0 && line[line.length - 1].style === style) {
        line[line.length - 1].text += ch;
      } else {
        line.push({ text: ch, style });
      }
    }
    lines.push(line);
  }

  return { lines };
}
