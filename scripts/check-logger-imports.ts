import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : [join(directory, entry.name)],
      ),
    )
  ).flat();
}

const violations: string[] = [];
for (const file of await files("src")) {
  if (!file.endsWith(".ts") || file.endsWith("observability/logger.ts"))
    continue;
  if (/from ["']pino["']/.test(await readFile(file, "utf8")))
    violations.push(file);
}
if (violations.length) {
  throw new Error(
    `Direct pino imports are forbidden:\n${violations.join("\n")}`,
  );
}
