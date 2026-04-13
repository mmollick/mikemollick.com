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
