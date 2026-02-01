import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const AUTOMATIONS_DIR = join(process.cwd(), "..", "automations");

function isValidAutomation(name: string): boolean {
  // Prevent path traversal
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  return existsSync(join(AUTOMATIONS_DIR, name, "prompt.md"));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!isValidAutomation(name)) {
    return NextResponse.json(
      { error: `Unknown automation: ${name}` },
      { status: 404 }
    );
  }

  try {
    const promptPath = join(AUTOMATIONS_DIR, name, "prompt.md");
    const prompt = await readFile(promptPath, "utf-8");
    return NextResponse.json({ name, prompt });
  } catch {
    return NextResponse.json(
      { error: "Prompt template not found" },
      { status: 404 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!isValidAutomation(name)) {
    return NextResponse.json(
      { error: `Unknown automation: ${name}` },
      { status: 404 }
    );
  }

  try {
    const promptPath = join(AUTOMATIONS_DIR, name, "prompt.md");
    const prompt = await readFile(promptPath, "utf-8");

    // Return the prompt for the client to paste into the terminal
    // The actual execution happens through the PTY session
    return NextResponse.json({
      name,
      prompt,
      instruction: "Paste this prompt into the active terminal session to execute.",
    });
  } catch {
    return NextResponse.json(
      { error: "Prompt template not found" },
      { status: 404 }
    );
  }
}
