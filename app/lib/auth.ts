import { NextResponse } from "next/server";

// Token-based auth for remote access (Tailscale)
// If BRIDGETTE_TOKEN is empty/unset, all requests are allowed (local dev mode)

function getToken(): string {
  return process.env.BRIDGETTE_TOKEN || "";
}

export function isAuthorized(request: Request): boolean {
  const token = getToken();
  if (!token) return true; // No token configured = local dev, allow all

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === token) {
    return true;
  }

  // Also check query param for browser convenience
  const url = new URL(request.url);
  if (url.searchParams.get("token") === token) {
    return true;
  }

  return false;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Max request body size (256KB) — prevents memory exhaustion from oversized payloads
const MAX_BODY_SIZE = 256 * 1024;

/**
 * Safely parse a JSON request body with size limits.
 * Returns the parsed object, or a NextResponse error if invalid/too large.
 */
export async function parseJsonBody(
  request: Request,
  maxSize = MAX_BODY_SIZE
): Promise<Record<string, unknown> | NextResponse> {
  // Check content-length header first (fast path rejection)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return NextResponse.json(
      { error: `Request body too large (max ${maxSize} bytes)` },
      { status: 413 }
    );
  }

  try {
    const text = await request.text();
    if (text.length > maxSize) {
      return NextResponse.json(
        { error: `Request body too large (max ${maxSize} bytes)` },
        { status: 413 }
      );
    }
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
    }
    return parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
