import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CAMPAIGN_STORE_ROW_ID,
  commitCampaignWrite,
  mergeSeedState,
  readCampaignSnapshot,
  writeCampaignSnapshot,
} from "./ledger.ts";
import type { CampaignStoreState, Organization, PortalUser } from "./types.ts";

function org(id: string, slug = id): Organization {
  return {
    id,
    name: id,
    type: "club",
    slug,
    contactEmail: `${id}@example.com`,
    bagShareCents: 400,
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

function user(id: string, email: string, extras: Partial<PortalUser> = {}): PortalUser {
  return {
    id,
    role: "club",
    name: id,
    email,
    passwordHash: `hash-${id}`,
    mustChangePassword: false,
    ...extras,
  };
}

function emptyState(): CampaignStoreState {
  return {
    organizations: [],
    athletes: [],
    campaigns: [],
    sales: [],
    payouts: [],
    users: [],
    booksEvents: [],
    campaignRequests: [],
  };
}

function seed(): CampaignStoreState {
  const state = emptyState();
  state.organizations.push(org("org-riverside", "riverside"));
  state.athletes.push({
    id: "athlete-maya",
    organizationId: "org-riverside",
    name: "Maya",
    email: "maya@example.com",
    createdAt: "2026-09-01T00:00:00.000Z",
  });
  state.campaigns.push({
    id: "camp-maya",
    organizationId: "org-riverside",
    athleteId: "athlete-maya",
    name: "Maya",
    slug: "maya-season-fund",
    story: "Seed story",
    goalBags: 10,
    status: "live",
    createdAt: "2026-09-01T00:00:00.000Z",
    publishedAt: "2026-09-02T00:00:00.000Z",
  });
  state.users.push(
    user("user-admin", "admin@nextpointcoffee.com", { role: "admin", mustChangePassword: false }),
    user("user-club", "coach@example.com", {
      organizationId: "org-riverside",
      mustChangePassword: false,
    })
  );
  return state;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("merge keeps durable campaigns and adds missing seed rows", () => {
  const durable = emptyState();
  durable.organizations.push(org("org-new", "new-club"));
  durable.users.push(
    user("user-new", "club@example.com", { mustChangePassword: true, passwordHash: "temp-hash" }),
    user("user-club", "coach@example.com", { passwordHash: "changed-hash", mustChangePassword: false })
  );

  const merged = mergeSeedState(durable, seed());
  assert.equal(merged.organizations.some((row) => row.id === "org-new"), true);
  assert.equal(merged.organizations.some((row) => row.id === "org-riverside"), true);
  assert.equal(merged.campaigns.some((row) => row.slug === "maya-season-fund"), true);
  const created = merged.users.find((row) => row.email === "club@example.com");
  assert.equal(created?.mustChangePassword, true);
  assert.equal(created?.passwordHash, "temp-hash");
  const coach = merged.users.find((row) => row.id === "user-club");
  assert.equal(coach?.passwordHash, "changed-hash");
  assert.equal(merged.users.filter((row) => row.email === "coach@example.com").length, 1);
  assert.equal(merged.users.some((row) => row.id === "user-admin"), true);
});

test("empty durable state is the seed ledger", () => {
  const merged = mergeSeedState(null, seed());
  assert.equal(merged.campaigns.length, 1);
  assert.equal(merged.users.length, 2);
});

test("a save is visible to the next read, including mustChangePassword", async () => {
  let stored: { version: number; state: CampaignStoreState } | null = null;
  const config = { url: "https://example.supabase.co", serviceKey: "service-key" };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET") {
      return jsonResponse(stored ? [{ version: stored.version, state: stored.state }] : []);
    }
    if (method === "POST") {
      const body = JSON.parse(String(init?.body));
      stored = { version: body.version, state: body.state };
      return jsonResponse([{ id: body.id, version: body.version }], 201);
    }
    const body = JSON.parse(String(init?.body));
    if (!url.includes("version=eq.") || !stored) return jsonResponse([]);
    stored = { version: body.version, state: body.state };
    return jsonResponse([{ version: body.version, state: body.state }]);
  };

  const created = mergeSeedState(null, seed());
  created.organizations.push(org("org-launch", "launch-club"));
  created.users.push(user("user-launch", "launch@example.com", { mustChangePassword: true }));
  assert.equal(await writeCampaignSnapshot(config, created, 0, fetchImpl), "ok");

  const snapshot = await readCampaignSnapshot(config, fetchImpl);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.state?.organizations.some((row) => row.id === "org-launch"), true);
  assert.equal(
    snapshot.state?.users.find((row) => row.email === "launch@example.com")?.mustChangePassword,
    true
  );
  assert.equal(snapshot.state?.campaigns.some((row) => row.id === "camp-maya"), true);
});

test("version conflicts retry on a fresh copy and keep both writes", async () => {
  const db = {
    version: 1,
    state: mergeSeedState(null, seed()),
  };
  db.state.organizations.push(org("org-a", "club-a"));
  let writes = 0;

  const saved = await commitCampaignWrite({
    read: async () => ({ state: structuredClone(db.state), version: db.version }),
    write: async (state, expectedVersion) => {
      writes += 1;
      if (writes === 1) {
        db.version = 2;
        db.state.organizations.push(org("org-b", "club-b"));
        return "conflict";
      }
      assert.equal(expectedVersion, 2);
      db.version = expectedVersion + 1;
      db.state = state;
      return "ok";
    },
    change: async (state) => {
      state.users.push(user("user-new", "new@example.com", { mustChangePassword: true }));
      return "created";
    },
  });

  assert.equal(saved, "created");
  assert.equal(db.state.users.filter((row) => row.id === "user-new").length, 1);
  assert.equal(db.state.organizations.some((row) => row.id === "org-a"), true);
  assert.equal(db.state.organizations.some((row) => row.id === "org-b"), true);
  assert.equal(db.state.users.find((row) => row.id === "user-new")?.mustChangePassword, true);
});

test("supabase writes use a compare-and-swap on campaign_store", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const config = { url: "https://example.supabase.co/", serviceKey: "service-key" };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? String(init.body) : undefined });
    if (method === "POST") return jsonResponse({ message: "duplicate" }, 409);
    if (method === "PATCH") return jsonResponse([]);
    return jsonResponse([]);
  };

  const state = emptyState();
  assert.equal(await writeCampaignSnapshot(config, state, 0, fetchImpl), "conflict");
  assert.equal(await writeCampaignSnapshot(config, state, 4, fetchImpl), "conflict");

  assert.equal(calls[0]?.method, "POST");
  assert.match(calls[0]?.url ?? "", /\/rest\/v1\/campaign_store$/);
  assert.equal(JSON.parse(calls[0]?.body ?? "{}").id, CAMPAIGN_STORE_ROW_ID);
  assert.match(calls[1]?.url ?? "", /id=eq\.ledger/);
  assert.match(calls[1]?.url ?? "", /version=eq\.4/);
  assert.equal(JSON.parse(calls[1]?.body ?? "{}").version, 5);
  assert.equal(calls.length, 2);
});

test("production store does not keep the ledger on the serverless tmp disk", async () => {
  const source = await readFile(new URL("./store.ts", import.meta.url), "utf8");
  const sql = await readFile(new URL("../../supabase/campaigns.sql", import.meta.url), "utf8");
  assert.equal(source.includes("/tmp"), false);
  assert.match(source, /campaignsUseSupabase/);
  assert.match(source, /mergeSeedState/);
  assert.match(source, /mustChangePassword: true/);
  assert.match(sql, /campaign_store/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public.campaign_store from anon, authenticated/);
});
