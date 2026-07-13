import { NextRequest } from "next/server";
import pg from "pg";

// ВРЕМЕННЫЙ роут для миграции: read-only выгрузка всех таблиц public в JSON.
// Защищён токеном. Удаляется сразу после снятия дампа. Только SELECT.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN = "87b2185914c286b87f22f88daf99614045cc22ad6baa9cc7";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  const conn = process.env.DATABASE_URL;
  if (!conn) return new Response("no DATABASE_URL", { status: 500 });

  const client = new pg.Client({
    connectionString: conn,
    ssl: conn.includes("sslmode=disable") ? false : undefined,
    statement_timeout: 45000,
  });

  try {
    await client.connect();
    const tbls = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    const dump: Record<string, unknown> = {
      _meta: { takenAt: new Date().toISOString(), tables: {} as Record<string, number> },
    };
    const counts = (dump._meta as { tables: Record<string, number> }).tables;
    for (const { tablename } of tbls.rows) {
      const r = await client.query(`SELECT * FROM "${tablename}"`);
      dump[tablename] = r.rows;
      counts[tablename] = r.rowCount ?? 0;
    }
    return new Response(
      JSON.stringify(dump, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response("ERR " + (e as Error).message, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
