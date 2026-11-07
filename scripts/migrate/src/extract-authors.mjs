import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const INPUT = process.env.WP_DUMP || path.join(ROOT, 'old/topovik.sql');
const OUT = path.join(__dirname, '../out/authors.json');

const MYSQL = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'wordpress',
};

/**
 * Parse a single VALUES tuple for wp_users row.
 * Columns: ID, user_login, user_pass, user_nicename, user_email, user_url,
 * user_registered, user_activation_key, user_status, display_name
 */
function parseUserTuple(tuple) {
  // lightweight CSV-ish parse for quoted SQL values
  const values = [];
  let i = 0;
  const s = tuple.trim();
  while (i < s.length) {
    if (s[i] === "'") {
      let out = '';
      i += 1;
      while (i < s.length) {
        if (s[i] === '\\') {
          out += s[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (s[i] === "'" && s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        if (s[i] === "'") {
          i += 1;
          break;
        }
        out += s[i];
        i += 1;
      }
      values.push(out);
      if (s[i] === ',') i += 1;
      continue;
    }
    if (s[i] === 'N' && s.slice(i, i + 4) === 'NULL') {
      values.push(null);
      i += 4;
      if (s[i] === ',') i += 1;
      continue;
    }
    let start = i;
    while (i < s.length && s[i] !== ',') i += 1;
    values.push(s.slice(start, i).trim());
    if (s[i] === ',') i += 1;
  }
  return values;
}

function splitTuples(valuesSql) {
  const tuples = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < valuesSql.length; i += 1) {
    const ch = valuesSql[i];
    if (ch === "'" ) {
      i += 1;
      while (i < valuesSql.length) {
        if (valuesSql[i] === '\\') {
          i += 2;
          continue;
        }
        if (valuesSql[i] === "'" && valuesSql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (valuesSql[i] === "'") break;
        i += 1;
      }
      continue;
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        tuples.push(valuesSql.slice(start, i));
        start = -1;
      }
    }
  }
  return tuples;
}

async function main() {
  const conn = await mysql.createConnection(MYSQL);
  const [rows] = await conn.query(
    `SELECT DISTINCT post_author AS id FROM wp_posts
     WHERE post_type IN ('post','page') AND post_status IN ('publish','draft','pending')`
  );
  await conn.end();

  const needed = new Set(rows.map((r) => Number(r.id)).filter(Boolean));
  console.log(`Need ${needed.size} author ids from dump`);

  const authors = {};
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.startsWith('INSERT INTO `wp_users`')) continue;
    const idx = line.indexOf('VALUES');
    if (idx < 0) continue;
    const tuples = splitTuples(line.slice(idx + 6));
    for (const t of tuples) {
      const vals = parseUserTuple(t);
      const id = Number(vals[0]);
      if (!needed.has(id)) continue;
      authors[id] = {
        id,
        login: vals[1],
        nicename: vals[3],
        email: vals[4],
        displayName: vals[9] || vals[1] || `Author ${id}`,
      };
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(authors, null, 2));
  console.log(`Wrote ${Object.keys(authors).length} authors -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
