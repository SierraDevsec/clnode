#!/usr/bin/env node
import { Command } from "commander";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const program = new Command();

const CLNODE_PORT = parseInt(process.env.CLNODE_PORT ?? "3100", 10);
const CLNODE_URL = `http://localhost:${CLNODE_PORT}`;
const DATA_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  "../../data"
);
const PID_FILE = path.join(DATA_DIR, "clnode.pid");
const LOG_FILE = path.join(DATA_DIR, "clnode.log");

program
  .name("clnode")
  .description("Claude Code hook monitoring daemon")
  .version("0.1.0");

// clnode start
program
  .command("start")
  .description("Start the clnode daemon")
  .option("-p, --port <port>", "Port number", String(CLNODE_PORT))
  .action(async (opts) => {
    // 이미 실행 중인지 확인
    if (isRunning()) {
      console.log(`[clnode] Already running (PID: ${readPid()})`);
      return;
    }

    const serverEntry = path.resolve(
      import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
      "../server/index.js"
    );

    // tsx로 실행 (dev) 또는 node로 실행 (build)
    const isTs = serverEntry.endsWith(".ts");
    const cmd = isTs ? "tsx" : "node";
    const actualEntry = isTs
      ? serverEntry
      : serverEntry;

    const env = { ...process.env, CLNODE_PORT: opts.port };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const logFd = fs.openSync(LOG_FILE, "a");
    const child = spawn(cmd, [actualEntry], {
      env,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    fs.closeSync(logFd);

    child.unref();

    if (child.pid) {
      const dataDir = path.dirname(PID_FILE);
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(PID_FILE, String(child.pid));
      console.log(`[clnode] Daemon started (PID: ${child.pid}, Port: ${opts.port})`);
    } else {
      console.error("[clnode] Failed to start daemon");
      process.exit(1);
    }
  });

// clnode stop
program
  .command("stop")
  .description("Stop the clnode daemon")
  .action(() => {
    const pid = readPid();
    if (!pid) {
      console.log("[clnode] No running daemon found");
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
      fs.unlinkSync(PID_FILE);
      console.log(`[clnode] Daemon stopped (PID: ${pid})`);
    } catch {
      console.log("[clnode] Daemon not running, cleaning up PID file");
      try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
    }
  });

// clnode status
program
  .command("status")
  .description("Show active sessions and agents")
  .action(async () => {
    try {
      const res = await fetch(`${CLNODE_URL}/api/health`);
      const health = await res.json() as { status: string; uptime: number };
      console.log(`[clnode] Server: ${health.status} (uptime: ${Math.round(health.uptime)}s)`);

      const sessionsRes = await fetch(`${CLNODE_URL}/api/sessions?active=true`);
      const sessions = await sessionsRes.json() as Array<Record<string, unknown>>;
      console.log(`[clnode] Active sessions: ${sessions.length}`);
      for (const s of sessions) {
        console.log(`  - ${s.id} (project: ${s.project_id ?? "none"})`);
      }

      const agentsRes = await fetch(`${CLNODE_URL}/api/agents?active=true`);
      const agents = await agentsRes.json() as Array<Record<string, unknown>>;
      console.log(`[clnode] Active agents: ${agents.length}`);
      for (const a of agents) {
        console.log(`  - ${a.id} [${a.agent_name}] (${a.agent_type ?? "unknown"})`);
      }
    } catch {
      console.log("[clnode] Daemon is not running");
      const pid = readPid();
      if (pid) console.log(`  PID file exists (${pid}), but server unreachable`);
    }
  });

// clnode init [path]
program
  .command("init [targetPath]")
  .description("Install lifecycle hooks in the target project")
  .option("-s, --with-skills", "Copy agent skill templates to .claude/skills/")
  .action(async (targetPath: string | undefined, opts: { withSkills?: boolean }) => {
    const target = targetPath ? path.resolve(targetPath) : process.cwd();
    const projectName = path.basename(target);
    const projectId = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const baseDir = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
    // hook.sh lives in src/hooks/ (included in npm package via files field)
    const hookScript = path.resolve(baseDir, "../../src/hooks/hook.sh");
    fs.chmodSync(hookScript, 0o755);

    const claudeDir = path.join(target, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const templatePath = path.resolve(baseDir, "../../templates/hooks-config.json");
    const templateRaw = fs.readFileSync(templatePath, "utf-8");
    const hooksConfig = JSON.parse(templateRaw.replaceAll("HOOK_SCRIPT_PATH", hookScript));

    const settingsPath = path.join(claudeDir, "settings.local.json");
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
    settings.hooks = hooksConfig.hooks;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`[clnode] Hooks installed to ${settingsPath}`);
    console.log(`[clnode] hook.sh path: ${hookScript}`);

    // Copy skill and agent templates if requested
    if (opts.withSkills) {
      const skillsSourceDir = path.resolve(baseDir, "../../templates/skills");
      const skillsTargetDir = path.join(claudeDir, "skills");

      if (fs.existsSync(skillsSourceDir)) {
        fs.mkdirSync(skillsTargetDir, { recursive: true });
        const skillFiles = fs.readdirSync(skillsSourceDir).filter((f: string) => f.endsWith(".md"));
        for (const file of skillFiles) {
          const dest = path.join(skillsTargetDir, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(path.join(skillsSourceDir, file), dest);
            console.log(`[clnode] Skill template copied: ${file}`);
          }
        }
        console.log(`[clnode] ${skillFiles.length} skill templates installed to ${skillsTargetDir}`);
      }

      const agentsSourceDir = path.resolve(baseDir, "../../templates/agents");
      const agentsTargetDir = path.join(claudeDir, "agents");

      if (fs.existsSync(agentsSourceDir)) {
        fs.mkdirSync(agentsTargetDir, { recursive: true });
        const agentFiles = fs.readdirSync(agentsSourceDir).filter((f: string) => f.endsWith(".md"));
        for (const file of agentFiles) {
          const dest = path.join(agentsTargetDir, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(path.join(agentsSourceDir, file), dest);
            console.log(`[clnode] Agent template copied: ${file}`);
          }
        }
        console.log(`[clnode] ${agentFiles.length} agent templates installed to ${agentsTargetDir}`);
      }

      const rulesSourceDir = path.resolve(baseDir, "../../templates/rules");
      const rulesTargetDir = path.join(claudeDir, "rules");

      if (fs.existsSync(rulesSourceDir)) {
        fs.mkdirSync(rulesTargetDir, { recursive: true });
        const rulesFiles = fs.readdirSync(rulesSourceDir).filter((f: string) => f.endsWith(".md"));
        for (const file of rulesFiles) {
          const dest = path.join(rulesTargetDir, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(path.join(rulesSourceDir, file), dest);
            console.log(`[clnode] Rule template copied: ${file}`);
          }
        }
        console.log(`[clnode] ${rulesFiles.length} rule templates installed to ${rulesTargetDir}`);
      }
    }

    try {
      await fetch(`${CLNODE_URL}/api/health`);
      const res = await fetch(`${CLNODE_URL}/hooks/RegisterProject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, project_name: projectName, project_path: target }),
      });
      if (res.ok) {
        console.log(`[clnode] Project registered: ${projectId} (${target})`);
      }
    } catch {
      console.log(`[clnode] Daemon not running — project will be registered on first hook event`);
    }

    console.log(`\n[clnode] Setup complete!`);
    console.log(`[clnode] Next steps:`);
    console.log(`  1. Start the daemon: clnode start`);
    console.log(`  2. Restart your Claude Code session (hooks activate on session start)`);
  });

// clnode logs
program
  .command("logs")
  .description("Tail daemon logs")
  .option("-n, --lines <lines>", "Number of lines to show", "50")
  .option("-f, --follow", "Follow log output")
  .action((opts) => {
    if (!fs.existsSync(LOG_FILE)) {
      console.log("[clnode] No log file found. Start the daemon first.");
      return;
    }

    const args = ["-n", opts.lines];
    if (opts.follow) args.push("-f");
    args.push(LOG_FILE);

    const tail = spawn("tail", args, { stdio: "inherit" });
    tail.on("error", () => {
      console.error("[clnode] Failed to run tail command");
    });
  });

// clnode ui
program
  .command("ui")
  .description("Open Web UI in browser")
  .action(() => {
    const url = CLNODE_URL;
    console.log(`[clnode] Opening ${url} ...`);
    try {
      if (process.platform === "darwin") {
        execSync(`open ${url}`);
      } else if (process.platform === "linux") {
        execSync(`xdg-open ${url}`);
      } else {
        execSync(`start ${url}`);
      }
    } catch {
      console.log(`[clnode] Could not open browser. Visit: ${url}`);
    }
  });

function readPid(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

program.parse();
