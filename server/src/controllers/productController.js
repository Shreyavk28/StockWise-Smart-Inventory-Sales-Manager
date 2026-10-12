
const mongoose = require("mongoose");
const { Product } = require("../models/Product");
const { Sale } = require("../models/Sale");
const asyncHandler = require("../utils/asyncHandler");

// Fields that may be changed after creation.
// SKU is intentionally absent — it is immutable.
const MUTABLE_FIELDS = [
  "name",
  "category",
  "sellingPrice",
  "quantity",
  "supplier",
  "minStockLevel",
];

// Translates MongoDB duplicate-key errors into a 409 response.
function parseDuplicateKeyError(err) {
  if (err.code !== 11000) return null;

  const field = Object.keys(err.keyValue || {})[0] || "field";
  const value = err.keyValue ? err.keyValue[field] : "";

  return {
    message:
      field === "sku"
        ? `A product with SKU "${value}" already exists`
        : `Duplicate value for field: ${field}`,
  };
}

// ---------------------------------------------------------------------------
// GET /api/products
// ---------------------------------------------------------------------------
const getAllProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    lowStock,
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
    // Escape regex metacharacters in user-supplied search text.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    filter.$or = [{ name: regex }, { sku: regex }];
  }

  if (category) {
    filter.category = category;
  }

  if (lowStock === "true") {
    filter.$expr = {
      $lte: ["$quantity", "$minStockLevel"],
    };
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);

  // Calculate units sold from actual Sale records for the products
  // on the current page. This avoids an additional query per product.
  const productIds = products.map((product) => product._id);

  const soldTotals = productIds.length
    ? await Sale.aggregate([
        {
          $match: {
            product: { $in: productIds },
          },
        },
        {
          $group: {
            _id: "$product",
            sold: { $sum: "$quantity" },
          },
        },
      ])
    : [];

  const soldByProduct = new Map(
    soldTotals.map((item) => [item._id.toString(), item.sold])
  );

  const productsWithSold = products.map((product) => ({
    ...product,
    sold: soldByProduct.get(product._id.toString()) || 0,
  }));

  res.status(200).json({
    success: true,
    data: productsWithSold,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/products/:id
// ---------------------------------------------------------------------------
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID format",
    });
  }

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// ---------------------------------------------------------------------------
// POST /api/products
// ---------------------------------------------------------------------------
const createProduct = asyncHandler(async (req, res) => {
  const body = { ...req.body };

  if (typeof body.sku === "string") {
    body.sku = body.sku.toUpperCase().trim();
  }

  let product;

  try {
    product = await Product.create(body);
  } catch (err) {
    const duplicate = parseDuplicateKeyError(err);

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: duplicate.message,
      });
    }

    throw err;
  }

  res.status(201).json({
    success: true,
    data: product,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/products/:id
// ---------------------------------------------------------------------------
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID format",
    });
  }

  // SKU cannot be changed after product creation.
  if ("sku" in req.body) {
    return res.status(400).json({
      success: false,
      message: "SKU cannot be changed after a product is created",
    });
  }

  // Only explicitly permitted fields can be updated.
  const updates = {};

  for (const field of MUTABLE_FIELDS) {
    if (field in req.body) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No updatable fields provided",
    });
  }

  let product;

  try {
    product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );
  } catch (err) {
    const duplicate = parseDuplicateKeyError(err);

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: duplicate.message,
      });
    }

    throw err;
  }

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/products/:id
// ---------------------------------------------------------------------------
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID format",
    });
  }

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  // Sales and StockMovement history remain preserved.
  res.status(200).json({
    success: true,
    message: "Product deleted",
  });
});

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
