import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, readdir } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(artifactDir, "src/__tests__");
const outDir = path.resolve(artifactDir, ".test-dist");

// Mirrors build.mjs's externals -- native/unbundleable packages this
// codebase doesn't actually use, kept here too so a shared dependency
// tree doesn't break the test bundle for the same reasons it would break
// the real build.
const external = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
  "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate",
  "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "lightningcss",
  "pg-native", "oracledb", "mongodb-client-encryption", "nodemailer", "handlebars",
  "knex", "typeorm", "protobufjs", "onnxruntime-node", "@tensorflow/*",
  "@prisma/client", "@mikro-orm/*", "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*",
  "@opentelemetry/*", "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
  "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
  "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis", "kerberos",
  "leveldown", "miniflare", "mysql2", "newrelic", "odbc", "piscina", "realm",
  "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport", "snappy",
  "tinypool", "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
  "playwright", "puppeteer", "puppeteer-core", "electron",
];

async function main() {
  await rm(outDir, { recursive: true, force: true });

  const files = (await readdir(testsDir)).filter((f) => f.endsWith(".test.ts"));
  if (files.length === 0) {
    console.log("No *.test.ts files found in src/__tests__ -- nothing to build.");
    return;
  }
  const banner = {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
  };
  const shared = {
    platform: "node",
    bundle: true,
    format: "esm",
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external,
    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
    banner,
  };

  // Test files land in outDir/__tests__ (node --test is pointed at that
  // subdirectory specifically, so seed.mjs living alongside it in outDir
  // doesn't get mistaken for a test file).
  await esbuild({ ...shared, entryPoints: files.map((f) => path.resolve(testsDir, f)), outdir: path.resolve(outDir, "__tests__") });
  // Also bundle seed.ts alongside the tests -- CI needs it to populate a
  // fresh database before the suite runs (see src/seed.ts's own doc comment).
  await esbuild({ ...shared, entryPoints: [path.resolve(artifactDir, "src/seed.ts")], outdir: outDir });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
