import { NextResponse } from "next/server";

/** Optional shared secret with nextpoint-books. Unset = open prototype pull. */
export function booksApiKey(): string | undefined {
  return process.env.BOOKS_API_KEY || undefined;
}

export function booksAuthHeaders(): Record<string, string> {
  const key = booksApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-NPC-Source": "next-point-coffee",
    "X-NPC-Contract-Version": "1",
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export function unauthorizedBooks(): NextResponse {
  return NextResponse.json({ error: "Books API key required." }, { status: 401 });
}

export function isBooksAuthorized(request: Request): boolean {
  const expected = booksApiKey();
  if (!expected) return true;
  const bearer = request.headers.get("authorization");
  const token = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
  const headerKey = request.headers.get("x-books-key") ?? "";
  return token === expected || headerKey === expected;
}
