import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

const AUTOMATIONS_DIR = join(process.cwd(), "..", "automations");

export async function GET() {
  try {
    const entries = await readdir(AUTOMATIONS_DIR, { withFileTypes: true });
    const automations = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const promptPath = join(AUTOMATIONS_DIR, entry.name, "prompt.md");
      try {
        const prompt = await readFile(promptPath, "utf-8");
        const info = await stat(promptPath);
        // Extract title from first markdown heading
        const titleMatch = prompt.match(/^#\s+(.+)$/m);
        automations.push({
          name: entry.name,
          title: titleMatch ? titleMatch[1] : entry.name,
          modified: info.mtime.toISOString(),
        });
      } catch {
        // No prompt.md — skip
      }
    }

    return NextResponse.json({ automations });
  } catch {
    return NextResponse.json(
      { error: "Failed to list automations" },
      { status: 500 }
    );
  }
}
