import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join, resolve } from "path";

const HOME_DIR = process.env.HOME || "/Users/abereyes";

// Allowed root directories for the directory picker.
// Prevents browsing arbitrary system paths like /etc, /var, etc.
const ALLOWED_ROOTS = [HOME_DIR, "/Volumes"];

function isAllowedPath(target: string): boolean {
  const resolved = resolve(target);
  return ALLOWED_ROOTS.some((root) => resolved === root || resolved.startsWith(root + "/"));
}

// List subdirectories of a given path for the directory picker
export async function GET(req: NextRequest) {
  const requestedPath = req.nextUrl.searchParams.get("path") || HOME_DIR;
  const resolvedPath = resolve(requestedPath);

  if (!isAllowedPath(resolvedPath)) {
    return NextResponse.json(
      { path: resolvedPath, dirs: [], error: "Path outside allowed directories" },
      { status: 403 }
    );
  }

  try {
    const entries = await readdir(resolvedPath, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: join(resolvedPath, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ path: resolvedPath, dirs });
  } catch {
    return NextResponse.json({ path: resolvedPath, dirs: [], error: "Cannot read directory" }, { status: 400 });
  }
}
