
const express = require("express");

const {
  createSale,
  getAllSales,
  getSaleById,
} = require("../controllers/saleController");

const router = express.Router();

// GET /api/sales - Retrieve paginated sales history
router.get("/", getAllSales);

// GET /api/sales/:id - Retrieve one sale
router.get("/:id", getSaleById);

// POST /api/sales - Record a sale and deduct stock
router.post("/", createSale);

module.exports = router;
