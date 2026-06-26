#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pagesFile = "pages.json";
let urls;
try {
  urls = JSON.parse(readFileSync(pagesFile, "utf8"));
} catch {
  console.error(`MISSING: ${pagesFile} not found or invalid JSON`);
  process.exit(1);
}

if (!Array.isArray(urls) || urls.length === 0) {
  console.error(`EMPTY: ${pagesFile} contains no URLs`);
  process.exit(1);
}

const tmp = join(tmpdir(), "jahia_pg_verify.html");
let allOk = true;

for (const url of urls) {
  let code, body;
  try {
    code = execSync(`curl -s -o "${tmp}" -w "%{http_code}" "${url}"`, { encoding: "utf8" }).trim();
    body = readFileSync(tmp, "utf8");
  } catch {
    console.log(`ERROR [unknown] ${url}`);
    allOk = false;
    continue;
  }
  const titleMatch = body.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const hasError =
    body.includes("error details are shown in development mode") ||
    body.includes("pl.touk.throwing");

  let status;
  if (hasError) {
    status = "ERROR_PAGE";
  } else if (code !== "200") {
    status = `HTTP_${code}`;
  } else {
    const mainMatch = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      const mainText = mainMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      status = mainText.length < 150 ? "INCOMPLETE" : "OK";
    } else {
      status = "OK";
    }
  }

  console.log(`${status} [${title}] ${url}`);
  if (status !== "OK") allOk = false;
}

process.exit(allOk ? 0 : 1);
