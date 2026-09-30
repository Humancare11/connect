// Prints and saves a pass/fail table (test-results/summary.md).
import fs from "node:fs";
import path from "node:path";

export default class SummaryReporter {
  rows = [];

  onTestEnd(test, result) {
    const err = result.errors?.[0]?.message || "";
    const firstLine = err
      .replace(/\u001b\[[0-9;]*m/g, "")
      .split("\n")
      .find((l) => l.trim()) || "";
    const notes = (test.annotations || [])
      .filter((a) => a.type === "note")
      .map((a) => a.description)
      .join(" | ");
    this.rows.push({
      title: test.title,
      status: result.status,
      seconds: (result.duration / 1000).toFixed(1),
      detail: firstLine.slice(0, 160),
      notes,
    });
  }

  onEnd() {
    const icon = (s) => (s === "passed" ? "PASS" : s === "skipped" ? "SKIP" : "FAIL");
    const lines = [
      "| # | Test | Result | Time (s) | Detail |",
      "|---|------|--------|----------|--------|",
      ...this.rows.map(
        (r, i) =>
          `| ${i + 1} | ${r.title} | ${icon(r.status)} | ${r.seconds} | ${[r.detail, r.notes]
            .filter(Boolean)
            .join(" / ")
            .replace(/\|/g, "\\|")} |`,
      ),
    ];
    const out = lines.join("\n");
    console.log(`\n${out}\n`);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path.join("test-results", "summary.md"), `${out}\n`);
  }
}
