
const express = require("express");

const {
  getAllStockMovements,
  getStockMovementById,
  restockProduct,
  adjustStock,
} = require("../controllers/stockMovementController");

const router = express.Router();

// Register specific POST routes before the /:id route.
router.post("/restock", restockProduct);
router.post("/adjust", adjustStock);

// Stock movement history endpoints.
router.get("/", getAllStockMovements);
router.get("/:id", getStockMovementById);

module.exports = router;
