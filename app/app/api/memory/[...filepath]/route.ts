import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, rename } from "fs/promises";
import { join } from "path";

const MEMORY_DIR = join(process.cwd(), "..", "memory");

// Max content size for memory files (1MB)
const MAX_CONTENT_SIZE = 1024 * 1024;

function resolveFilePath(filepath: string[]): string {
  // Reject path segments that could escape the memory directory
  for (const segment of filepath) {
    if (segment === ".." || segment.includes("\0")) {
      throw new Error("Path traversal detected");
    }
  }

  const resolved = join(MEMORY_DIR, ...filepath);

  // Belt-and-suspenders: verify resolved path is still under MEMORY_DIR
  if (!resolved.startsWith(MEMORY_DIR + "/") && resolved !== MEMORY_DIR) {
    throw new Error("Path traversal detected");
  }

  // Only allow .md files
  if (!resolved.endsWith(".md")) {
    throw new Error("Only .md files are allowed");
  }

  return resolved;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filepath: string[] }> }
) {
  try {
    const { filepath } = await params;
    const fullPath = resolveFilePath(filepath);
    const content = await readFile(fullPath, "utf-8");
    return NextResponse.json({ path: filepath.join("/"), content });
  } catch (error: any) {
    if (error.message === "Path traversal detected" || error.message === "Only .md files are allowed") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ filepath: string[] }> }
) {
  try {
    const { filepath } = await params;
    const fullPath = resolveFilePath(filepath);
    const { content } = await request.json();

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    if (content.length > MAX_CONTENT_SIZE) {
      return NextResponse.json(
        { error: `Content exceeds maximum size (${MAX_CONTENT_SIZE} bytes)` },
        { status: 400 }
      );
    }

    // Atomic write: write to temp file, then rename
    const tmpPath = `${fullPath}.tmp`;
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, fullPath);

    return NextResponse.json({ path: filepath.join("/"), saved: true });
  } catch (error: any) {
    if (error.message === "Path traversal detected" || error.message === "Only .md files are allowed") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to write file" },
      { status: 500 }
    );
  }
}
