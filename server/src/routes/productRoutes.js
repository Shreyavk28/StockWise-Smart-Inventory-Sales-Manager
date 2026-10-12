const express = require("express");
const router = express.Router();

const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const {
  createProductRules,
  updateProductRules,
  listProductRules,
  runValidation,
} = require("../middleware/validate");

// GET /api/products
router.get("/", listProductRules, runValidation, getAllProducts);

// GET /api/products/:id
router.get("/:id", getProductById);

// POST /api/products
router.post("/", createProductRules, runValidation, createProduct);

// PUT /api/products/:id
router.put("/:id", updateProductRules, runValidation, updateProduct);

// DELETE /api/products/:id
router.delete("/:id", deleteProduct);

module.exports = router;
