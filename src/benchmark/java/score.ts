import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

const AUTHORIZATION = `Basic ${Buffer.from("root:root1234").toString("base64")}`;

interface Answer {
  status: number;
  contentType: string;
  json: Record<string, unknown> | undefined;
}

async function call(url: string, init: RequestInit = {}): Promise<Answer> {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), ...init });
  const text = await response.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, contentType: response.headers.get("content-type") ?? "", json };
}

function describe({ status, contentType, json }: Answer): string {
  return `${status} ${contentType || "(no content type)"} ${json ? JSON.stringify(json) : "(not JSON)"}`;
}

function isQuote(answer: Answer, product: string, age: number, premium: number): boolean {
  return (
    answer.status === 200 &&
    answer.contentType.includes("application/json") &&
    answer.json?.["product"] === product &&
    answer.json?.["age"] === age &&
    answer.json?.["monthlyPremium"] === premium &&
    answer.json?.["currency"] === "EUR"
  );
}

function isError(answer: Answer, error: string): boolean {
  return answer.status === 400 && answer.json?.["error"] === error;
}

/** Checks the forsure-quote module that the agent wrote in `projectDir` and deployed on `jahiaUrl`. */
export async function scoreQuoteModule(projectDir: string, jahiaUrl: string): Promise<Check[]> {
  const checks: Check[] = [];
  const action = `${jahiaUrl}/sites/systemsite/home.quote.do`;

  const build = spawnSync("mvn", ["-B", "-q", "package"], {
    cwd: resolve(projectDir, "forsure-quote"),
    encoding: "utf-8",
    timeout: 10 * 60 * 1000,
  });
  checks.push({
    name: "mvn package passes",
    passed: build.status === 0,
    detail: build.status === 0 ? "ok" : (build.stdout + build.stderr).slice(-500),
  });

  const quotes: Array<[string, number, number]> = [
    ["car", 30, 45],
    ["car", 20, 67.5],
    ["health", 70, 78],
    ["home", 40, 25],
  ];
  for (const [product, age, premium] of quotes) {
    const answer = await call(`${action}?product=${product}&age=${age}`);
    checks.push({
      name: `guest GET ${product}, age ${age} = ${premium}`,
      passed: isQuote(answer, product, age, premium),
      detail: describe(answer),
    });
  }

  const errors: Array<[string, string, string]> = [
    ["unknown product", "product=boat&age=40", "invalid-product"],
    ["non-numeric age", "product=car&age=abc", "invalid-age"],
    ["missing age", "product=car", "invalid-age"],
    ["age out of range", "product=car&age=12", "invalid-age"],
  ];
  for (const [name, query, error] of errors) {
    const answer = await call(`${action}?${query}`);
    checks.push({ name: `${name}: 400 ${error}`, passed: isError(answer, error), detail: describe(answer) });
  }

  const browserError = await call(`${action}?product=boat&age=40`, { headers: { Accept: "text/html" } });
  checks.push({
    name: "error is JSON for Accept: text/html",
    passed: isError(browserError, "invalid-product"),
    detail: describe(browserError),
  });

  const post = await call(`${action}?product=car&age=30`, { method: "POST" });
  checks.push({
    name: "POST gets no quote",
    passed: post.json?.["monthlyPremium"] === undefined,
    detail: describe(post),
  });

  const editor = await call(`${action}?product=car&age=30`, { headers: { Authorization: AUTHORIZATION } });
  checks.push({
    name: "logged-in GET car, age 30 = 45",
    passed: isQuote(editor, "car", 30, 45),
    detail: describe(editor),
  });

  const provisioning = await fetch(`${jahiaUrl}/modules/api/provisioning`, {
    method: "POST",
    headers: { Authorization: AUTHORIZATION, "Content-Type": "application/yaml" },
    body: '- editConfiguration: "org.forsure.quote"\n  properties:\n    car: "50"\n',
    signal: AbortSignal.timeout(30_000),
  });
  let reloaded: Answer | undefined;
  for (let attempt = 0; attempt < 15 && provisioning.ok; attempt++) {
    await setTimeout(2000);
    reloaded = await call(`${action}?product=car&age=30`);
    if (isQuote(reloaded, "car", 30, 50)) break;
  }
  checks.push({
    name: "configuration car=50 applies without redeployment",
    passed: reloaded !== undefined && isQuote(reloaded, "car", 30, 50),
    detail: reloaded ? describe(reloaded) : `provisioning answered ${provisioning.status}`,
  });

  return checks;
}

export function printChecks(checks: Check[]): string {
  const passed = checks.filter((check) => check.passed).length;
  const lines = [
    `Java module checks: ${passed}/${checks.length}`,
    "",
    "| Check | Result | Detail |",
    "| --- | --- | --- |",
    ...checks.map(
      ({ name, passed, detail }) =>
        `| ${name} | ${passed ? "pass" : "FAIL"} | ${detail.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`,
    ),
  ];
  return lines.join("\n");
}

// `node src/benchmark/java/score.ts <project dir>` scores a module without running the agent
if (import.meta.filename === resolve(process.argv[1] ?? "")) {
  const checks = await scoreQuoteModule(
    resolve(process.argv[2] ?? "."),
    process.env["JAHIA_URL"] ?? "http://localhost:8080",
  );
  console.log(printChecks(checks));
  process.exit(checks.every((check) => check.passed) ? 0 : 1);
}
