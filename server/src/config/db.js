const mongoose = require("mongoose");

/**
 * Verifies that the connected MongoDB server supports multi-document
 * transactions by running the driver's `hello` command.
 *
 * Transactions require a replica set or sharded cluster.
 * A standalone mongod does NOT support them, and StockWise relies on
 * transactions for atomic stock deduction + Sale + StockMovement writes.
 *
 * Why `hello` instead of a URL string check?
 * The connection string can include "replicaSet=rs0" before the set has
 * actually been initiated. The `hello` command queries the real running
 * server and returns its actual role, so the check is reliable.
 *
 * This function THROWS on failure rather than calling process.exit().
 * The caller (connectDB) lets the error propagate to the startup handler
 * in server.js, which is responsible for closing the connection and exiting.
 */
async function checkTransactionSupport() {
  const admin = mongoose.connection.db.admin();

  // `hello` is the modern replacement for `isMaster`.
  // Replica set members include `setName` in the response.
  // Mongos routers (sharded clusters) include `msg: "isdbgrid"`.
  const hello = await admin.command({ hello: 1 });

  const isReplicaSet = Boolean(hello.setName);
  const isSharded = hello.msg === "isdbgrid";

  if (!isReplicaSet && !isSharded) {
    throw new Error(
      [
        "",
        "FATAL: Transactions are not supported on this MongoDB instance.",
        "StockWise requires a replica set or sharded cluster for atomic stock updates.",
        "",
        "To fix this, use one of the following options:",
        "  • MongoDB Atlas (M0 free tier and above) — replica set included by default.",
        "  • Local replica set: start mongod with --replSet rs0, then run rs.initiate() once.",
        "",
        "Update MONGODB_URI in your .env file and restart the server.",
        "",
      ].join("\n")
    );
  }

  const topologyType = isSharded ? "sharded cluster" : "replica set";
  const setInfo = hello.setName ? ` (setName: "${hello.setName}")` : "";
  console.log(`✅  Transactions supported — topology: ${topologyType}${setInfo}`);
}

/**
 * Connects to MongoDB and verifies transaction support.
 *
 * Resolves only when both steps succeed.
 * Rejects (throws) if:
 *   - MONGODB_URI is missing from the environment
 *   - mongoose.connect() fails (bad URI, network error, auth failure, etc.)
 *   - checkTransactionSupport() detects a standalone topology
 *
 * Callers are responsible for catching the error, closing the connection
 * if needed, and exiting the process. This function does not call
 * process.exit() — that decision belongs to the startup handler.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not defined. Copy .env.example to .env and fill in your connection string."
    );
  }

  console.log("⏳  Connecting to MongoDB…");
  await mongoose.connect(uri);
  console.log("✅  Connected to MongoDB.");

  // Throws if topology does not support transactions.
  // The open connection must be closed by the caller if this throws.
  await checkTransactionSupport();
}

module.exports = connectDB;
