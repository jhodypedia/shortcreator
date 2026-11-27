import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export interface GflowGenerationOptions {
  prompt: string;
  outputPath: string;
  model: string;
  maxCredits: number;
  aspect?: "9:16" | "16:9";
  duration?: number;
  timeoutMs?: number;
  onProgress?: (progress: number, detail?: string) => void | Promise<void>;
}

export interface GflowGenerationResult {
  outputPath: string;
  model: string;
  elapsedMs: number;
  stdout: string;
}

const execFileAsync = promisify(execFile);
let loginProcess: ReturnType<typeof spawn> | null = null;
let loginStartedAt: number | null = null;
let loginLastOutput = "";

export async function startGflowLogin(): Promise<{ started: boolean; alreadyRunning: boolean }> {
  if (loginProcess && loginProcess.exitCode === null && !loginProcess.killed) return { started: false, alreadyRunning: true };
  const resolved = await resolveGflowCommand(true);
  const child = spawn(resolved.command, [...resolved.prefix, "auth", "login", "--browser", "chrome"], {
    shell: false,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GFLOW_CLI_TELEMETRY: "off" },
  });
  loginProcess = child;
  loginStartedAt = Date.now();
  loginLastOutput = "";
  const remember = (chunk: Buffer) => { loginLastOutput = (loginLastOutput + chunk.toString("utf8")).slice(-2000); };
  child.stdout?.on("data", remember);
  child.stderr?.on("data", remember);
  child.once("exit", () => { if (loginProcess === child) loginProcess = null; });
  child.once("error", (error) => { loginLastOutput = error.message; if (loginProcess === child) loginProcess = null; });
  child.unref();
  return { started: true, alreadyRunning: false };
}

export function gflowLoginProgress(): { running: boolean; startedAt: number | null; detail?: string } {
  return { running: Boolean(loginProcess && loginProcess.exitCode === null && !loginProcess.killed), startedAt: loginStartedAt, detail: loginLastOutput.trim() || undefined };
}

async function resolveGflowCommand(allowUvBootstrap = true): Promise<{ command: string; prefix: string[] }> {
  if (process.env.GFLOW_BIN) return { command: process.env.GFLOW_BIN, prefix: [] };
  const pathCandidates = [
    process.env.HOME ? path.join(process.env.HOME, ".local/bin/gflow") : "",
    process.env.HOME ? path.join(process.env.HOME, ".local/share/uv/tools/gflow-cli/bin/gflow") : "",
    "/usr/local/bin/gflow",
    "/usr/bin/gflow",
  ].filter(Boolean);
  for (const candidate of pathCandidates) {
    try { await fs.access(candidate); return { command: candidate, prefix: [] }; } catch { /* probe next */ }
  }
  try {
    const { stdout } = await execFileAsync("uv", ["tool", "dir", "--bin"], { timeout: 5_000 });
    const candidate = path.join(stdout.trim(), "gflow");
    await fs.access(candidate);
    return { command: candidate, prefix: [] };
  } catch { /* use uvx ephemeral install */ }
  if (!allowUvBootstrap) throw new Error("gflow-cli is not installed for the service user; install it with `uv tool install gflow-cli`.");
  return { command: "uvx", prefix: ["--from", "gflow-cli", "gflow"] };
}

function parseJsonLines(stdout: string): Record<string, unknown>[] {
  const values: Record<string, unknown>[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") values.push(parsed as Record<string, unknown>);
    } catch { /* gflow emits structured JSON logs and a final result; skip non-JSON lines */ }
  }
  return values;
}

export async function gflowStatus(): Promise<{ installed: boolean; authenticated: boolean; version?: string; detail?: string }> {
  const version = await runGflow(["--version"], { timeoutMs: 12_000, allowFailure: true, allowUvBootstrap: false }).catch((error) => ({ code: 127, stdout: "", stderr: error instanceof Error ? error.message : "gflow executable missing" }));
  if (version.code !== 0) return { installed: false, authenticated: false, detail: version.stderr.slice(-500) || "gflow executable not found" };
  const auth = await runGflow(["auth", "status"], { timeoutMs: 20_000, allowFailure: true, allowUvBootstrap: false }).catch((error) => ({ code: 127, stdout: "", stderr: error instanceof Error ? error.message : "gflow executable missing" }));
  const authText = `${auth.stdout}\n${auth.stderr}`;
  const authenticated = auth.code === 0 && !/no profiles found|not authenticated|signed out|no session/i.test(authText);
  return {
    installed: true,
    authenticated,
    version: version.stdout.trim().split(/\s+/).at(-1),
    detail: authenticated ? undefined : authText.trim().slice(-500) || "Flow profile is not signed in",
  };
}

export async function generateWithGflow(options: GflowGenerationOptions): Promise<GflowGenerationResult> {
  const outputPath = path.resolve(options.outputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const started = Date.now();
  const args = [
    "video", "t2v", options.prompt,
    "--aspect", options.aspect ?? "9:16",
    "--model", options.model,
    "--max-credits", String(options.maxCredits),
    "--out-file", outputPath,
    "--json",
  ];
  if (options.duration) args.push("--duration", String(options.duration));
  const result = await runGflow(args, { timeoutMs: options.timeoutMs ?? 12 * 60_000 });
  const stat = await fs.stat(outputPath).catch(() => null);
  if (!stat?.isFile() || stat.size < 128) {
    const payload = parseJsonLines(result.stdout).at(-1);
    throw new Error(String(payload?.detail ?? payload?.error ?? "gflow reported success but did not create a valid MP4"));
  }
  if (!stat || !stat.isFile()) throw new Error("gflow output is not a regular file");
  const signature = await fs.open(outputPath, "r");
  try { const bytes = Buffer.alloc(12); await signature.read(bytes, 0, 12, 0); if (bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("gflow output is not a valid MP4 container"); } finally { await signature.close(); }
  return { outputPath, model: options.model, elapsedMs: Date.now() - started, stdout: result.stdout.slice(-4000) };
}

function runGflow(args: string[], options: { timeoutMs: number; allowFailure?: boolean; allowUvBootstrap?: boolean; onProgress?: GflowGenerationOptions["onProgress"] }): Promise<{ code: number; stdout: string; stderr: string }> {
  const resolvedPromise = resolveGflowCommand(options.allowUvBootstrap ?? true);
  return resolvedPromise.then((resolved) => new Promise((resolve, reject) => {
  const executable = resolved.command;
  const commandArgs = [...resolved.prefix, ...args];
    const child = spawn(executable, commandArgs, {
      shell: false,
      windowsHide: true,
      env: { ...process.env, GFLOW_CLI_EXIT_CODES: "2", GFLOW_CLI_TELEMETRY: "off" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => { child.kill("SIGTERM"); finishError(new Error("gflow command timed out")); }, options.timeoutMs);
    const finishError = (error: Error) => { if (settled) return; settled = true; clearTimeout(timer); reject(error); };
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    let lineBuffer = "";
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-64_000);
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\r?\n/); lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const item = JSON.parse(line) as Record<string, unknown>;
          const progress = Number(item.progress ?? item.percent);
          if (Number.isFinite(progress)) void options.onProgress?.(Math.max(1, Math.min(99, Math.round(progress))), typeof item.message === "string" ? item.message : undefined);
        } catch { /* ignore human-readable log lines */ }
      }
    });
    child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-16_000); });
    child.on("error", (error) => finishError(new Error(`gflow could not start: ${error.message}`)));
    child.on("close", (code) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !options.allowFailure) {
        const payload = parseJsonLines(stdout).at(-1);
        const detail = String(payload?.detail ?? payload?.error ?? stderr.trim().split("\n").at(-1) ?? `exit ${exitCode}`);
        resolveOrReject();
        function resolveOrReject() { reject(new Error(`gflow exited (${exitCode}): ${detail.slice(0, 700)}`)); }
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  }));
}
