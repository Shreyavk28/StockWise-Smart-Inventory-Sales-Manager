
const mongoose = require("mongoose");
const { Product } = require("../models/Product");
const { Sale } = require("../models/Sale");
const { StockMovement } = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");

// ---------------------------------------------------------------------------
// POST /api/sales
// Create a sale, deduct stock, and record the stock movement atomically.
// ---------------------------------------------------------------------------
const createSale = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

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
    typeof quantity !== "number" ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be a positive whole number",
    });
  }

  const session = await mongoose.startSession();

  try {
    let createdSale;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);

      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      if (
        !Number.isFinite(product.sellingPrice) ||
        product.sellingPrice <= 0
      ) {
        const error = new Error("Product has an invalid selling price");
        error.statusCode = 400;
        throw error;
      }

      if (
        !Number.isSafeInteger(product.quantity) ||
        product.quantity < 0
      ) {
        const error = new Error("Product has an invalid stock quantity");
        error.statusCode = 400;
        throw error;
      }

      if (product.quantity < quantity) {
        const error = new Error(
          `Insufficient stock. Available quantity: ${product.quantity}`
        );
        error.statusCode = 409;
        throw error;
      }

      // Always use the product price stored in the database.
      const unitPrice = product.sellingPrice;
      const totalAmount = Math.round(unitPrice * quantity * 100) / 100;

      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        const error = new Error("Sale total is invalid");
        error.statusCode = 400;
        throw error;
      }

      // Deduct stock only when enough inventory remains.
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: product._id,
          quantity: { $gte: quantity },
        },
        {
          $inc: { quantity: -quantity },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedProduct) {
        const error = new Error(
          "Stock changed before the sale could be completed. Please retry."
        );
        error.statusCode = 409;
        throw error;
      }

      // Create the sale record within the same transaction.
      const sales = await Sale.create(
        [
          {
            product: product._id,
            productName: product.name,
            sku: product.sku,
            quantity,
            unitPrice,
            totalAmount,
          },
        ],
        { session }
      );

      createdSale = sales[0];

      // Create the stock movement within the same transaction.
      await StockMovement.create(
        [
          {
            product: product._id,
            productName: product.name,
            sku: product.sku,
            type: "OUT",
            quantity,
            reason: "SALE",
            reference: createdSale._id,
          },
        ],
        { session }
      );
    });

    return res.status(201).json({
      success: true,
      data: createdSale,
      message: "Sale recorded successfully",
    });
  } finally {
    await session.endSession();
  }
});

// ---------------------------------------------------------------------------
// GET /api/sales
// Retrieve paginated sales history.
// ---------------------------------------------------------------------------
const getAllSales = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(req.query.pageSize, 10) || 20)
  );
  const skip = (page - 1) * pageSize;

  const [sales, total] = await Promise.all([
    Sale.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Sale.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: sales,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/sales/:id
// Retrieve a sale by ID.
// ---------------------------------------------------------------------------
const getSaleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid sale ID format",
    });
  }

  const sale = await Sale.findById(id).lean();

  if (!sale) {
    return res.status(404).json({
      success: false,
      message: "Sale not found",
    });
  }

  res.status(200).json({
    success: true,
    data: sale,
  });
});

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
};
