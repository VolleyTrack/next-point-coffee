import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PORTAL_COOKIE } from "@/lib/campaigns/auth";
import { getUserById, listUsers } from "@/lib/campaigns/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const id = jar.get(PORTAL_COOKIE)?.value;
  const user = id ? await getUserById(id) : null;
  return NextResponse.json({ user, users: await listUsers() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const jar = await cookies();

  if (!userId) {
    jar.delete(PORTAL_COOKIE);
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unknown demo user." }, { status: 400 });
  }

  jar.set(PORTAL_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ user });
}
