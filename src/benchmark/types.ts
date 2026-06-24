import type { CndIssue } from "../harness/skills/jahia-dev-review-cnd/scripts/check-cnd.mjs";
export type { CndIssue };

export interface PageResult {
  url: string;
  title: string;
  screenshot: string | null; // filename relative to run dir in results/
  accessibilityScore: number | null; // 0–1
  seoScore: number | null; // 0–1
}

export interface BenchmarkRun {
  id: string;
  date: string; // ISO 8601
  durationSeconds: number;
  tokens: {
    input: number;
    output: number;
    cached: number;
  };
  githubRunUrl?: string | undefined;
  branch?: string | undefined; // defaults to "main" for backward compatibility
  pages: PageResult[];
  cndQualityScore: number | null; // 0–1, null if no CND files found
  cndIssues?: CndIssue[] | undefined;
}
