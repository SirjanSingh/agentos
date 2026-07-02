import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getConfig, repoRoot } from "../config.js";

export interface SkillParam {
  name: string;
  label: string;
  type: "string" | "select";
  options?: string[];
  default?: string;
  required?: boolean;
  placeholder?: string;
}

export interface SkillManifest {
  id: string; // filename without .skill.md
  name: string;
  description: string;
  icon: string; // emoji
  params: SkillParam[];
  cwd: string; // absolute, resolved
  allowedTools: string[];
  permissionMode: "default" | "acceptEdits" | "plan";
  model?: string;
  maxTurns?: number;
  promptTemplate: string;
}

const skillsDir = path.join(repoRoot, "skills");

export function loadSkills(): SkillManifest[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".skill.md"));
  } catch {
    return [];
  }
  const skills: SkillManifest[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(skillsDir, f), "utf8");
      const { data, content } = matter(raw);
      const cwdRaw: string = data.cwd || repoRoot;
      skills.push({
        id: f.replace(/\.skill\.md$/, ""),
        name: data.name ?? f,
        description: data.description ?? "",
        icon: data.icon ?? "⚡",
        params: Array.isArray(data.params) ? data.params : [],
        cwd: path.isAbsolute(cwdRaw) ? cwdRaw : path.resolve(repoRoot, cwdRaw),
        allowedTools: Array.isArray(data.allowedTools) ? data.allowedTools : [],
        permissionMode: data.permissionMode ?? "default",
        model: data.model,
        maxTurns: data.maxTurns,
        promptTemplate: content.trim(),
      });
    } catch (err) {
      console.error(`[skills] failed to load ${f}:`, err);
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkill(id: string): SkillManifest | undefined {
  return loadSkills().find((s) => s.id === id);
}

/** Fill {{param}} placeholders; {{vault}}, {{projectsRoot}}, {{today}} are built in. */
export function renderPrompt(skill: SkillManifest, params: Record<string, string>): string {
  const cfg = getConfig();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const values: Record<string, string> = {
    vault: cfg.vaultPath,
    projectsRoot: cfg.projectsRoot,
    claudeHome: cfg.claudeHome,
    today,
    ...Object.fromEntries(
      skill.params.map((p) => [p.name, params[p.name] ?? p.default ?? ""]),
    ),
  };
  return skill.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}
