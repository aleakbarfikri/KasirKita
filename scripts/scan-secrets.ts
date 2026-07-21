import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Resend API key", /\bre_[A-Za-z0-9_-]{24,}\b/],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/],
] as const;

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings: string[] = [];
for (const file of files) {
  if (/\.(?:png|jpe?g|gif|ico|woff2?|pdf|lock)$/i.test(file)) continue;
  let content = "";
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  for (const [label, pattern] of patterns) if (pattern.test(content)) findings.push(`${file}: ${label}`);
}
if (findings.length) {
  console.error(`Potential secrets detected:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} tracked and pending files).`);
