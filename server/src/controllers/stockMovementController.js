
const mongoose = require("mongoose");
const { Product } = require("../models/Product");
const { StockMovement } = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");

// ---------------------------------------------------------------------------
// GET /api/stock-movements
// Returns paginated stock movement history, newest first.
// ---------------------------------------------------------------------------
const getAllStockMovements = asyncHandler(async (req, res) => {
  const {
    search,
    type,
    reason,
    page: rawPage,
    pageSize: rawPageSize,
  } = req.query;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(rawPageSize, 10) || 20)
  );
  const skip = (page - 1) * pageSize;

  const filter = {};

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    filter.$or = [
      { productName: regex },
      { sku: regex },
    ];
  }

  if (type && ["IN", "OUT"].includes(type)) {
    filter.type = type;
  }

  if (reason && ["SALE", "RESTOCK", "ADJUSTMENT"].includes(reason)) {
    filter.reason = reason;
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: movements,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/stock-movements/:id
// ---------------------------------------------------------------------------
const getStockMovementById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid stock movement ID format",
    });
  }

  const movement = await StockMovement.findById(id).lean();

  if (!movement) {
    return res.status(404).json({
      success: false,
      message: "Stock movement not found",
    });
  }

  res.status(200).json({
    success: true,
    data: movement,
  });
});

// ---------------------------------------------------------------------------
// POST /api/stock-movements/restock
// Adds stock and records the movement in one transaction.
// Body: { productId, quantity }
// ---------------------------------------------------------------------------
const restockProduct = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({
      success: false,
      message: "A valid productId is required",
    });
  }

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be a positive whole number",
    });
  }

  const session = await mongoose.startSession();

  try {
    let responseData;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity } },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedProduct) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      const [movement] = await StockMovement.create(
        [
          {
            product: product._id,
            productName: product.name,
            sku: product.sku,
            type: "IN",
            quantity,
            reason: "RESTOCK",
            reference: null,
          },
        ],
        { session }
      );

      responseData = {
        product: updatedProduct,
        movement,
      };
    });

    res.status(201).json({
      success: true,
      message: "Stock added successfully",
      data: responseData,
    });
  } finally {
    await session.endSession();
  }
});

// ---------------------------------------------------------------------------
// POST /api/stock-movements/adjust
// Sets actual stock and records the difference in one transaction.
// Body: { productId, actualQuantity }
// ---------------------------------------------------------------------------
const adjustStock = asyncHandler(async (req, res) => {
  const { productId, actualQuantity } = req.body;

  if (
    typeof productId !== "string" ||
    !mongoose.isValidObjectId(productId)
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid productId is required",
    });
  }

  if (
    !Number.isSafeInteger(actualQuantity) ||
    actualQuantity < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Actual quantity must be a non-negative whole number",
    });
  }

  const session = await mongoose.startSession();

  try {
    let responseData;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      const previousQuantity = product.quantity;
      const difference = actualQuantity - previousQuantity;

      if (difference === 0) {
        const error = new Error(
          "Actual quantity matches current stock. No adjustment is needed."
        );
        error.statusCode = 400;
        throw error;
      }

      // Update only if the quantity still matches what we read.
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          quantity: previousQuantity,
        },
        {
          $set: { quantity: actualQuantity },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedProduct) {
        const error = new Error(
          "Stock changed during adjustment. Please retry."
        );
        error.statusCode = 409;
        throw error;
      }

      const [movement] = await StockMovement.create(
        [
          {
            product: product._id,
            productName: product.name,
            sku: product.sku,
            type: difference > 0 ? "IN" : "OUT",
            quantity: Math.abs(difference),
            reason: "ADJUSTMENT",
            reference: null,
          },
        ],
        { session }
      );

      responseData = {
        product: updatedProduct,
        movement,
        previousQuantity,
        actualQuantity,
        difference,
      };
    });

    res.status(201).json({
      success: true,
      message: "Stock adjusted successfully",
      data: responseData,
    });
  } finally {
    await session.endSession();
  }
});

module.exports = {
  getAllStockMovements,
  getStockMovementById,
  restockProduct,
  adjustStock,
};
