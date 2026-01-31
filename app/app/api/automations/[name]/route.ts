import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const AUTOMATIONS_DIR = join(process.cwd(), "..", "automations");

const VALID_AUTOMATIONS = ["content-creation", "job-search", "codebase-eval"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!VALID_AUTOMATIONS.includes(name)) {
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

  if (!VALID_AUTOMATIONS.includes(name)) {
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
