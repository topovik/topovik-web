#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Replace mass-rewrite updated_at with a stable timestamp slightly after published_at.
 * published_at is never changed.
 *
 *   PGHOST=127.0.0.1 PGPORT=5434 node scripts/migrate/src/normalize-updated-at.mjs
 *
 * Prod via docker:
 *   docker compose -f docker-compose.prod.yml exec -T postgres \
 *     psql -U topovik -d topovik -f - < scripts/migrate/sql/normalize-updated-at.sql
 */

const PG = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5434),
  user: process.env.PGUSER || "topovik",
  password: process.env.PGPASSWORD || "topovik",
  database: process.env.PGDATABASE || "topovik",
};

const sqlPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../sql/normalize-updated-at.sql",
);

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new pg.Client(PG);
  await client.connect();
  try {
    const res = await client.query(sql);
    const selects = (Array.isArray(res) ? res : [res]).filter(
      (r) => r.command === "SELECT",
    );
    console.log(selects.at(-1)?.rows?.[0] || "done");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
