import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { isAuthorized, unauthorizedResponse } from "@/lib/auth";

const AUTOMATIONS_DIR = join(process.cwd(), "..", "automations");

// Only allow safe alphanumeric + hyphen/underscore names (no path traversal possible)
const SAFE_NAME_RE = /^[a-zA-Z0-9_-]{1,100}$/;

function isValidAutomation(name: string): boolean {
  if (!SAFE_NAME_RE.test(name)) return false;
  return existsSync(join(AUTOMATIONS_DIR, name, "prompt.md"));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  const { name } = await params;

  if (!isValidAutomation(name)) {
    return NextResponse.json(
      { error: "Unknown automation" },
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
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!isAuthorized(request)) return unauthorizedResponse();
  const { name } = await params;

  if (!isValidAutomation(name)) {
    return NextResponse.json(
      { error: "Unknown automation" },
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
