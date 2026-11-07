import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const INPUT = process.env.WP_DUMP || path.join(ROOT, 'old/topovik.sql');
const OUTPUT = process.env.FILTERED_DUMP || path.join(__dirname, '../filtered.sql');

const KEEP = new Set([
  'wp_posts',
  'wp_postmeta',
  'wp_terms',
  'wp_term_taxonomy',
  'wp_term_relationships',
  'wp_comments',
  'wp_aioseo_posts',
]);

const CREATE_RE = /^CREATE TABLE `([^`]+)`/;
const INSERT_RE = /^INSERT INTO `([^`]+)`/;
const DROP_RE = /^DROP TABLE IF EXISTS `([^`]+)`/;
const ALTER_RE = /^ALTER TABLE `([^`]+)`/;

function tableFromLine(line) {
  return (
    line.match(CREATE_RE)?.[1] ||
    line.match(INSERT_RE)?.[1] ||
    line.match(DROP_RE)?.[1] ||
    line.match(ALTER_RE)?.[1] ||
    null
  );
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Dump not found: ${INPUT}`);
  }

  console.log(`Filtering ${INPUT} -> ${OUTPUT}`);
  const out = fs.createWriteStream(OUTPUT);
  out.write(`-- Filtered WordPress dump for Topovik migration\n`);
  out.write(`SET NAMES utf8mb4;\n`);
  out.write(`SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n`);
  out.write(`SET FOREIGN_KEY_CHECKS=0;\n`);
  out.write(`CREATE DATABASE IF NOT EXISTS \`wordpress\` DEFAULT CHARACTER SET utf8mb4;\n`);
  out.write(`USE \`wordpress\`;\n\n`);

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let keepBlock = false;
  let currentTable = null;
  let kept = 0;
  let skipped = 0;
  let lineNo = 0;

  for await (const line of rl) {
    lineNo += 1;
    if (lineNo % 50000 === 0) {
      process.stdout.write(`\rlines ${lineNo} kept~${kept} skipped~${skipped}`);
    }

    const table = tableFromLine(line);
    if (table) {
      currentTable = table;
      keepBlock = KEEP.has(table);
    }

    // End of CREATE TABLE engine line ends block conceptually for next statements
    if (!table && keepBlock && /^UNLOCK TABLES;|^\/\*\!/.test(line)) {
      // still write unlocks when in keep mode
    }

    if (
      line.startsWith('SET ') ||
      line.startsWith('START TRANSACTION') ||
      line.startsWith('COMMIT') ||
      line.startsWith('/*!')
    ) {
      // skip global SET from original to avoid latin1 issues; we set our own
      skipped += 1;
      continue;
    }

    if (line.startsWith('USE ') || line.startsWith('CREATE DATABASE')) {
      skipped += 1;
      continue;
    }

    if (keepBlock || (currentTable && KEEP.has(currentTable) && line.trim() === ';')) {
      out.write(line);
      out.write('\n');
      kept += 1;
    } else {
      skipped += 1;
    }

    // After CREATE TABLE closing parenthesis/engine, keep stays until next table marker
    if (table && !KEEP.has(table)) {
      keepBlock = false;
    }
  }

  out.write(`\nSET FOREIGN_KEY_CHECKS=1;\n`);
  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on('error', reject);
  });

  const sizeMb = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
  console.log(`\nDone. kept lines≈${kept}, size=${sizeMb}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
