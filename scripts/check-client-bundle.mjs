#!/usr/bin/env node
// Inspects a Next.js production build (the .next directory) and fails when browser code could reach
// the model adapter or start a process (PRD section 4 criterion 16, CLAUDE.md "Never from the browser").
//
// Client bundles (.next/static) must contain none of:
//   - Node process APIs: child_process, spawn(), execFile(), execSync()
//   - a CLI call to claude, the Anthropic API host or SDK
//   - the model adapter or Review module names, Review's prompt, or the fake adapter's scripted reply
// Server output (.next/server) must contain no Claude call: the Anthropic API host or SDK, or a CLI
// call to claude. (Server code legitimately holds the fake adapter; it is switched off on Vercel.)
//
// Usage: node scripts/check-client-bundle.mjs [buildDir=.next]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CLAUDE_CALL_RULES = [
  { id: "anthropic-api-host", re: /api\.anthropic\.com/ },
  { id: "anthropic-sdk", re: /@anthropic-ai\// },
  { id: "claude-cli-call", re: /["'`]claude["'`]\s*,\s*\[/ },
  { id: "claude-cli-command", re: /["'`]claude\s+(-p|--print)\b/ },
];

function scriptedReplies() {
  // A distinctive opening of each scripted reply, so leaked fixture output is caught.
  const dir = path.join(repoRoot, "fixtures/model-output");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).summary)
    .filter((s) => typeof s === "string" && s.length >= 40)
    .map((s, i) => ({ id: `fake-scripted-reply-${i + 1}`, literal: s.slice(0, 40) }));
}

const CLIENT_RULES = [
  { id: "child-process", re: /child_process/ },
  { id: "process-spawn", re: /(?<![\w$])(spawn|spawnSync|execFile|execFileSync|execSync)\s*\(/ },
  { id: "model-adapter", re: /redline-model-adapter/ },
  { id: "review-module", re: /redline-review:server/ },
  { id: "review-prompt", re: /You are summarising a contract/ },
  ...CLAUDE_CALL_RULES,
];

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

function scan(files, rules, literals = []) {
  const findings = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const { id, re } of rules) {
      const m = re.exec(src);
      if (m) findings.push({ file, rule: id, excerpt: src.slice(Math.max(0, m.index - 40), m.index + 60) });
    }
    for (const { id, literal } of literals) {
      const i = src.indexOf(literal);
      if (i >= 0) findings.push({ file, rule: id, excerpt: src.slice(Math.max(0, i - 40), i + 60) });
    }
  }
  return findings;
}

/**
 * @param {string} buildDir A Next.js build output directory.
 * @returns {{ clientFiles: number, serverFiles: number, findings: { file: string, rule: string, excerpt: string }[] }}
 */
export function checkBuild(buildDir) {
  const clientFiles = listFiles(path.join(buildDir, "static"), [".js", ".mjs"]);
  const serverFiles = listFiles(path.join(buildDir, "server"), [".js", ".mjs"]);
  if (clientFiles.length === 0) {
    throw new Error(`No client bundles under ${path.join(buildDir, "static")}. Run "next build" first.`);
  }
  const findings = [
    ...scan(clientFiles, CLIENT_RULES, scriptedReplies()).map((f) => ({ ...f, side: "client" })),
    ...scan(serverFiles, CLAUDE_CALL_RULES).map((f) => ({ ...f, side: "server" })),
  ];
  return { clientFiles: clientFiles.length, serverFiles: serverFiles.length, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const buildDir = path.resolve(process.argv[2] ?? ".next");
  let result;
  try {
    result = checkBuild(buildDir);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const { clientFiles, serverFiles, findings } = result;
  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} finding(s) in ${buildDir}`);
    for (const f of findings) {
      console.error(`  [${f.side}] ${f.rule} in ${path.relative(buildDir, f.file)}: ...${f.excerpt.replace(/\s+/g, " ")}...`);
    }
    process.exit(1);
  }
  console.log(`PASS: ${clientFiles} client bundle(s) and ${serverFiles} server file(s) in ${buildDir}; no path to the model adapter or a Claude call.`);
}
