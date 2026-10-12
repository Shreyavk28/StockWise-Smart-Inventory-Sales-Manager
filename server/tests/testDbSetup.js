// tests/testDbSetup.js

const path = require("path");

// Load server/.env using an absolute path derived from this file's location.
// __dirname is tests/, so "../.env" resolves to server/.env regardless of
// the directory from which Jest is invoked.
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Step 1 — Require MONGODB_URI_TEST. No fallback to MONGODB_URI.
// ---------------------------------------------------------------------------
const uri = process.env.MONGODB_URI_TEST;

if (!uri) {
  throw new Error(
    "\n❌  MONGODB_URI_TEST is not set." +
    "\n   Integration tests require a dedicated test database." +
    "\n   Add MONGODB_URI_TEST to server/.env, for example:" +
    "\n   MONGODB_URI_TEST=mongodb+srv://<user>:<pass>@<cluster>/stockwise-test" +
    "\n   Never point MONGODB_URI_TEST at your development database.\n"
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Validate scheme, hostname, and database name before connecting.
//           Error messages never include the URI value or credentials.
// ---------------------------------------------------------------------------
const ALLOWED_SCHEMES = ["mongodb:", "mongodb+srv:"];

let parsedUri;
try {
  parsedUri = new URL(uri);
} catch {
  throw new Error(
    "\n❌  MONGODB_URI_TEST is not a valid URI." +
    "\n   Check server/.env — do not wrap the value in quotes.\n"
  );
}

if (!ALLOWED_SCHEMES.includes(parsedUri.protocol)) {
  throw new Error(
    "\n❌  MONGODB_URI_TEST must use mongodb:// or mongodb+srv://." +
    `\n   Protocol found: "${parsedUri.protocol}"\n`
  );
}

if (!parsedUri.hostname) {
  throw new Error(
    "\n❌  MONGODB_URI_TEST is missing a hostname." +
    "\n   Check that the URI includes a valid host, for example:" +
    "\n   mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/stockwise-test\n"
  );
}

// parsedUri.pathname is the path component of the URI, e.g. "/stockwise-test".
// Strip the leading slash to get the bare database name.
// The URL parser keeps the query string out of pathname, so no further
// splitting is needed.
const dbName = parsedUri.pathname.replace(/^\//, "");

if (dbName !== "stockwise-test") {
  throw new Error(
    '\n❌  MONGODB_URI_TEST must target the "stockwise-test" database.' +
    `\n   Database name found: "${dbName || "(empty)"}"` +
    "\n   Update the URI so its path is /stockwise-test.\n"
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Jest lifecycle hooks.
//
// setupFilesAfterEnv executes this file once per test suite. With --runInBand,
// suites run serially in a single process, giving the sequence:
//
//   [suite 1]  beforeAll → connect
//              beforeEach × N → clean products
//              afterAll  → clean products, disconnect
//   [suite 2]  beforeAll → connect
//              beforeEach × N → clean products
//              afterAll  → clean products, disconnect
//
// Each suite manages its own full connect/disconnect pair. There is no
// connection overlap between suites.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await mongoose.connect(uri);
});

beforeEach(async () => {
  // Clean the products collection between tests.
  // Guard: only attempt when the connection is fully open.
  if (mongoose.connection.readyState !== 1) return;

  const col = mongoose.connection.collections.products;
  if (col) {
    await col.deleteMany({});
  }
});

afterAll(async () => {
  try {
    // Attempt cleanup only when fully connected.
    // dropDatabase() is never called — only the products collection is touched.
    if (mongoose.connection.readyState === 1) {
      const col = mongoose.connection.collections.products;
      if (col) {
        await col.deleteMany({});
      }
    }
  } finally {
    // Disconnect if the connection is open (1) or still establishing (2).
    // readyState 0 = already disconnected, 3 = already disconnecting —
    // no action needed in those states.
    if (
      mongoose.connection.readyState === 1 ||
      mongoose.connection.readyState === 2
    ) {
      await mongoose.disconnect();
    }
  }
});
