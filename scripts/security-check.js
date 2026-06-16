#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ignoredDirs = new Set([".git", "node_modules", ".github"]);
const ignoredFiles = new Set(["package-lock.json"]);
const findings = [];

const patterns = [
  { name: "OpenRouter API key", regex: /sk-or-v1-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI API key", regex: /sk-[A-Za-z0-9]{32,}/ },
  { name: "Anthropic API key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { name: "private local path", regex: /\/home\/tjb\b|C:\\Users\\tjb\b/i },
  { name: "dotenv secret assignment", regex: /\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*["']?[^"'\s]+/ },
];

function isAllowedGeneratedValue(line) {
  return line.includes("crypto.randomBytes") || line.includes("process.env.");
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (!entry.isFile() || ignoredFiles.has(entry.name)) continue;
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          if (pattern.name === "dotenv secret assignment" && isAllowedGeneratedValue(line)) continue;
          findings.push(`${rel}:${index + 1} ${pattern.name}`);
        }
      }
    });
  }
}

walk(root);

if (findings.length) {
  console.error("Security scan found possible sensitive data:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Security scan passed.");
