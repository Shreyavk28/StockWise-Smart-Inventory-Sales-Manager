
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const saleRoutes = require("./routes/saleRoutes");
const stockMovementRoutes = require("./routes/stockMovementRoutes");

// ---------------------------------------------------------------------------
// Express application setup
// ---------------------------------------------------------------------------

const app = express();

// Parse incoming JSON request bodies.
app.use(express.json());

// Restrict cross-origin requests to the configured frontend origin.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "StockWise API is running",
  });
});

// Product management routes.
app.use("/api/products", productRoutes);

// Sales management routes.
app.use("/api/sales", saleRoutes);

app.use("/api/stock-movements", stockMovementRoutes);
// ---------------------------------------------------------------------------
// Error handlers (must be registered after all routes)
// ---------------------------------------------------------------------------

// 404 — no route matched the request.
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Centralized error handler.
app.use((err, _req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500;

  console.error(`[Error] ${statusCode} — ${err.message}`);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  console.log(
    `\n⏳ ${signal} received — closing MongoDB connection…`
  );

  try {
    await mongoose.disconnect();
    console.log("✅ MongoDB connection closed. Goodbye.");
    process.exit(0);
  } catch (err) {
    console.error(
      `❌ Failed to close MongoDB connection: ${err.message}`
    );
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Startup — connect to MongoDB first, then start listening
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // connectDB verifies that MongoDB supports transactions.
    await connectDB();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(
        `   Health check: http://localhost:${PORT}/api/health`
      );
    });
  } catch (err) {
    console.error(`\n❌ Startup failed:\n${err.message}`);

    // Close the connection if startup fails after connecting.
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
        console.log(
          "✅ MongoDB connection closed after startup failure."
        );
      } catch (disconnectErr) {
        console.error(
          `❌ Also failed to close MongoDB connection: ${disconnectErr.message}`
        );
      }
    }

    process.exit(1);
  }
}

// Do not start a listener when imported by automated tests.
if (require.main === module) {
  start();
}

module.exports = app;
