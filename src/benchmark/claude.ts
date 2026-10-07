import { spawn } from "node:child_process";
import { once } from "node:events";
import type { BenchmarkRun } from "./types.ts";

// ─── Pretty-printer for Claude stream-json output ────────────────────────────

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
} as const;

function col(code: string, text: string): string {
  return `${code}${text}${C.reset}`;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function fmtInput(input: Record<string, unknown>): string {
  if (typeof input["file_path"] === "string") return input["file_path"];
  if (typeof input["command"] === "string") return (input["command"] as string).slice(0, 120);
  if (typeof input["prompt"] === "string") return (input["prompt"] as string).slice(0, 120);
  if (typeof input["path"] === "string") return input["path"] as string;
  if (typeof input["pattern"] === "string") return input["pattern"] as string;
  if (typeof input["skill"] === "string") return input["skill"] as string;
  if (typeof input["query"] === "string") return (input["query"] as string).slice(0, 120);
  if (typeof input["old_string"] === "string")
    return `"${(input["old_string"] as string).slice(0, 60).replace(/\n/g, "↵")}…"`;
  return JSON.stringify(input).slice(0, 150);
}

let _lastTime = Date.now();
const _toolNames = new Map<string, string>();

function fmtDiff(): string {
  const now = Date.now();
  const diff = now - _lastTime;
  _lastTime = now;
  const label =
    diff >= 10_000
      ? `+${(diff / 1_000).toFixed(0)}s`
      : diff >= 1_000
        ? `+${(diff / 1_000).toFixed(1)}s`
        : `+${diff}ms`;
  return col(C.dim, label);
}

function prettyPrintLine(line: string): void {
  if (!line.trim()) return;
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line);
  } catch {
    process.stdout.write(line + "\n");
    return;
  }

  switch (event["type"] as string) {
    case "system":
      break; // session init — no useful info to show
    case "assistant": {
      const msg = (event["message"] as Record<string, unknown>) ?? {};
      const content = (msg["content"] as unknown[]) ?? [];
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b["type"] === "text") {
          const text = ((b["text"] as string) ?? "").trimEnd();
          if (text) console.log(`${col(C.bold, text)} ${fmtDiff()}`);
        } else if (b["type"] === "tool_use") {
          const name = (b["name"] as string) ?? "unknown";
          const id = (b["id"] as string) ?? "";
          const input = (b["input"] as Record<string, unknown>) ?? {};
          _toolNames.set(id, name);
          console.log(`${col(C.cyan, `  ▶ ${name}`)} ${col(C.dim, fmtInput(input))} ${fmtDiff()}`);
        }
      }
      break;
    }
    case "user": {
      const msg = (event["message"] as Record<string, unknown>) ?? {};
      const content = (msg["content"] as unknown[]) ?? [];
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b["type"] === "tool_result") {
          const id = (b["tool_use_id"] as string) ?? "";
          const name = _toolNames.get(id) ?? "unknown";
          const isError = b["is_error"] as boolean;
          const raw = b["content"];
          let preview = "";
          if (typeof raw === "string") {
            preview = raw.slice(0, 250);
          } else if (Array.isArray(raw)) {
            const first = (raw[0] as Record<string, unknown>) ?? {};
            preview = ((first["text"] as string) ?? "").slice(0, 250);
          }
          if (preview.length === 250) preview += "…";
          preview = preview.replace(/\n/g, "↵");
          const label = isError ? col(C.yellow, `  ✗ ${name}`) : col(C.dim, `  ◀ ${name}`);
          if (preview) console.log(`${label} ${col(C.dim, preview)} ${fmtDiff()}`);
          else console.log(`${label} ${fmtDiff()}`);
        }
      }
      break;
    }
    case "result": {
      const durationMs = (event["duration_ms"] as number) ?? 0;
      const costUsd = (event["total_cost_usd"] as number) ?? 0;
      const numTurns = (event["num_turns"] as number) ?? 0;
      const usage = (event["usage"] as Record<string, number>) ?? {};
      const subtype = (event["subtype"] as string) ?? "";
      const ok = subtype === "success";
      console.log("");
      console.log(
        col(
          ok ? C.green : C.yellow,
          `${ok ? "✓" : "✗"} ${numTurns} turns · ${(durationMs / 1_000).toFixed(0)}s · $${costUsd.toFixed(2)}`,
        ),
      );
      console.log(
        col(
          C.dim,
          `  ↑${fmtCount(usage["input_tokens"] ?? 0)} ↓${fmtCount(usage["output_tokens"] ?? 0)} cached=${fmtCount(usage["cache_read_input_tokens"] ?? 0)}`,
        ),
      );
      break;
    }
    default:
      console.log(col(C.dim, `[${event["type"]}] ${JSON.stringify(event).slice(0, 100)}`));
  }
}

/** Runs Claude Code in `cwd` on `prompt`, prints its stream live, and returns the raw stream-json output. */
export async function runClaude(cwd: string, prompt: string): Promise<string> {
  const claudeProc = spawn(
    "claude",
    [
      "--print",
      "--verbose",
      "--dangerously-skip-permissions",
      "--model",
      "claude-sonnet-4-6",
      "--max-turns",
      "500",
      "--output-format",
      "stream-json",
      prompt,
    ],
    {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env },
    },
  );

  let claudeOutput = "";
  let _lineBuf = "";
  claudeProc.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    claudeOutput += text;
    _lineBuf += text;
    const lines = _lineBuf.split("\n");
    _lineBuf = lines.pop() ?? "";
    for (const line of lines) prettyPrintLine(line);
  });
  claudeProc.stdout.on("end", () => {
    if (_lineBuf.trim()) prettyPrintLine(_lineBuf);
  });
  claudeProc.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  await once(claudeProc, "exit");
  return claudeOutput;
}

// Parse token usage, cost, and duration from claude's stream-json output.
// The final line has type "result" with duration_ms, total_cost_usd, and usage fields.
export function parseStats(output: string): {
  durationSeconds: number;
  costUSD: number;
  tokens: BenchmarkRun["tokens"];
} {
  for (const line of output.trim().split("\n").reverse()) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (event["type"] === "result") {
        const usage = (event["usage"] as Record<string, number>) ?? {};
        return {
          durationSeconds: Math.round(((event["duration_ms"] as number) ?? 0) / 1000),
          costUSD: (event["total_cost_usd"] as number) ?? 0,
          tokens: {
            input: usage["input_tokens"] ?? 0,
            output: usage["output_tokens"] ?? 0,
            cached: usage["cache_read_input_tokens"] ?? 0,
          },
        };
      }
    } catch {
      // not a JSON line
    }
  }
  return { durationSeconds: 0, costUSD: 0, tokens: { input: 0, output: 0, cached: 0 } };
}
