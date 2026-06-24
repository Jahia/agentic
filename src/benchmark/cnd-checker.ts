import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CndIssue } from "./types.ts";

export interface CndCheckResult {
  score: number; // 0–1, same exponential decay formula as accessibility
  issues: CndIssue[];
  filesChecked: number;
}

function findCndFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    try {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
          walk(join(current, entry.name));
        } else if (entry.isFile() && entry.name.endsWith(".cnd")) {
          results.push(join(current, entry.name));
        }
      }
    } catch {
      // skip unreadable directories
    }
  }
  walk(dir);
  return results;
}

function checkFile(filePath: string, content: string): CndIssue[] {
  const issues: CndIssue[] = [];
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("<")) return;

    // rawStringLink
    if (/^-\s+\w*(Url|Href|Link)\s+\(string[,)]/i.test(trimmed) &&
        !/choicelist\[linkTypeInitializer\]/.test(trimmed)) {
      const propName = trimmed.match(/^-\s+(\w+)/)?.[1] ?? "unknown";
      issues.push({
        severity: "error",
        file: filePath,
        line: lineNum,
        pattern: "rawStringLink",
        message: `"${propName}" uses (string) for a link/url — use choicelist[linkTypeInitializer]`,
        fix: "Replace with: - j:linkType (string, choicelist[linkTypeInitializer]) mandatory",
      });
    }

    // rawTitleProp
    if (/^-\s+(title|heroTitle|pageTitle|sectionTitle)\s+\(string[,)]/i.test(trimmed)) {
      const propName = trimmed.match(/^-\s+(\w+)/)?.[1] ?? "unknown";
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "rawTitleProp",
        message: `"${propName}" is a plain string — extend mix:title instead`,
        fix: "Add mix:title to the type declaration and remove this property",
      });
    }

    // weakrefNoConstraint: (weakreference) with no < constraint on same line
    if (/\(weakreference[,)]/.test(trimmed) && !/<\s*\S/.test(trimmed)) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "weakrefNoConstraint",
        message: "Unconstrained weakreference — add a type constraint",
        fix: "Add e.g. (weakreference, picker[type='image']) < jmix:image",
      });
    }

    // weakrefWrongConstraint
    if (/< ['"]jnt:file['"]/.test(trimmed)) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "weakrefWrongConstraint",
        message: "< 'jnt:file' (quoted) does not enforce image type",
        fix: "Replace with < jmix:image for images",
      });
    }

    // missingI18n: user-visible string without i18n
    if (
      /^-\s+\w+\s+\(string(,\s*(textarea|richtext))?[,)]/.test(trimmed) &&
      !/ i18n/.test(trimmed) &&
      !/^-\s+j:/.test(trimmed) &&
      /(title|text|label|description|subtitle|caption|alt|heading|summary|excerpt|body)/i.test(trimmed)
    ) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "missingI18n",
        message: "User-visible string property missing i18n",
        fix: "Add i18n keyword after the type declaration",
      });
    }

    // directDroppable: concrete type (not mixin) extending jmix:droppableContent
    if (trimmed.startsWith("[") && /jmix:droppableContent/.test(trimmed) && !/\bmixin\b/.test(trimmed)) {
      issues.push({
        severity: "error",
        file: filePath,
        line: lineNum,
        pattern: "directDroppable",
        message: "Extends jmix:droppableContent directly — always extend the module component mixin",
        fix: "Replace jmix:droppableContent with nsmix:component (or your module's equivalent)",
      });
    }

    // studioOnly
    if (/jmix:studioOnly/.test(trimmed)) {
      issues.push({
        severity: "warning",
        file: filePath,
        line: lineNum,
        pattern: "studioOnly",
        message: "jmix:studioOnly causes silent rendering issues",
        fix: "Replace with jmix:hiddenType",
      });
    }
  });

  // singleHardcodedCta: check whole-file type blocks
  const typeBlocks = content.split(/(?=^\[)/m);
  for (const block of typeBlocks) {
    if (!block.trim().startsWith("[")) continue;
    const hasCtaLabel = /^\s*-\s+cta(Text|Label|ButtonText|ButtonLabel)\s+\(/im.test(block);
    const hasCtaLink = /^\s*-\s+cta(Link|Url|Href|ButtonLink|ButtonUrl)\s+\(/im.test(block);
    const hasChildNodes = /^\s*\+\s+/.test(block);
    if (hasCtaLabel && hasCtaLink && !hasChildNodes) {
      const typeName = block.match(/^\[(\S+)\]/m)?.[1] ?? "unknown";
      const typeLineIdx = lines.findIndex((l) => l.includes(`[${typeName}]`));
      issues.push({
        severity: "error",
        file: filePath,
        ...(typeLineIdx >= 0 ? { line: typeLineIdx + 1 } : {}),
        pattern: "singleHardcodedCta",
        message: `${typeName}: flat ctaText+ctaLink forces a single CTA — model as child nodes`,
        fix: "Remove ctaText and ctaLink. Add: + * (ns:cta). Create a [ns:cta] type with label + j:linkType",
      });
    }
  }

  return issues;
}

export function checkCndFiles(projectDir: string): CndCheckResult {
  const files = findCndFiles(projectDir);
  const allIssues: CndIssue[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      allIssues.push(...checkFile(file, content));
    } catch {
      // skip unreadable files
    }
  }

  const penalty = allIssues.reduce(
    (t, { severity }) => t + (severity === "error" ? 0.5 : 0.2),
    0,
  );
  const score = Math.exp(-penalty);

  return { score, issues: allIssues, filesChecked: files.length };
}
