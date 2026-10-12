const { body, query, validationResult } = require("express-validator");
const { CATEGORIES } = require("../models/Product");

// ---------------------------------------------------------------------------
// Reusable field rules
// ---------------------------------------------------------------------------

const nameRule = () =>
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 200 })
    .withMessage("Product name must be 200 characters or fewer");

const skuRule = () =>
  body("sku")
    .trim()
    .notEmpty()
    .withMessage("SKU is required")
    .isLength({ max: 100 })
    .withMessage("SKU must be 100 characters or fewer");

const categoryRule = () =>
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn(CATEGORIES)
    .withMessage(`Category must be one of: ${CATEGORIES.join(", ")}`);

// sellingPrice — must be a JSON number (not string/boolean/null/array/object),
// finite, and greater than zero.
const sellingPriceRule = () =>
  body("sellingPrice")
    .notEmpty()
    .withMessage("Selling price is required")
    .custom((v) => typeof v === "number")
    .withMessage("Selling price must be a number, not a string or boolean")
    .bail()
    .custom((v) => Number.isFinite(v))
    .withMessage("Selling price must be a finite number")
    .bail()
    .custom((v) => v > 0)
    .withMessage("Selling price must be greater than zero");

// quantity — must be a JSON number, a whole integer, and at least zero.
const quantityRule = () =>
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .custom((v) => typeof v === "number")
    .withMessage("Quantity must be a number, not a string or boolean")
    .bail()
    .custom((v) => Number.isInteger(v))
    .withMessage("Quantity must be a whole number")
    .bail()
    .custom((v) => v >= 0)
    .withMessage("Quantity cannot be negative");

const supplierRule = () =>
  body("supplier")
    .optional({ nullable: true, checkFalsy: false })
    .trim()
    .isLength({ max: 200 })
    .withMessage("Supplier name must be 200 characters or fewer");

// minStockLevel — optional (schema default 5 applies when omitted).
// When present, must be a JSON number, a whole integer, and at least zero.
const minStockLevelRule = () =>
  body("minStockLevel")
    .optional()
    .custom((v) => typeof v === "number")
    .withMessage("Minimum stock level must be a number, not a string or boolean")
    .bail()
    .custom((v) => Number.isInteger(v))
    .withMessage("Minimum stock level must be a whole number")
    .bail()
    .custom((v) => v >= 0)
    .withMessage("Minimum stock level cannot be negative");

// ---------------------------------------------------------------------------
// Exported validation chains
// ---------------------------------------------------------------------------

/**
 * Rules for POST /api/products — all required fields must be present.
 */
const createProductRules = [
  nameRule(),
  skuRule(),
  categoryRule(),
  sellingPriceRule(),
  quantityRule(),
  supplierRule(),
  minStockLevelRule(),
];

/**
 * Rules for PUT /api/products/:id — all fields are optional (partial update),
 * but each field that IS provided must still satisfy the same constraints.
 * SKU is NOT listed here — its presence in the body is caught by the
 * controller's allowlist check, which returns HTTP 400 explicitly.
 */
const updateProductRules = [
  nameRule().optional(),
  categoryRule().optional(),
  sellingPriceRule().optional(),
  quantityRule().optional(),
  supplierRule(),
  minStockLevelRule(),
];

/**
 * Rules for GET /api/products query parameters.
 */
const listProductRules = [
  // search — optional string, max 100 characters.
  // Prevents excessively long regex patterns from reaching the database.
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .isLength({ max: 100 })
    .withMessage("Search term must be 100 characters or fewer"),

  query("category")
    .optional()
    .isIn(CATEGORIES)
    .withMessage(`Category must be one of: ${CATEGORIES.join(", ")}`),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("pageSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize must be between 1 and 100"),

  query("lowStock")
    .optional()
    .isIn(["true", "false"])
    .withMessage('lowStock must be "true" or "false"'),
];

/**
 * Middleware that reads the express-validator result and, if there are errors,
 * responds with HTTP 400 and a structured errors array.
 *
 * Must be placed after the rule chain and before the controller function.
 */
function runValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: result.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

module.exports = {
  createProductRules,
  updateProductRules,
  listProductRules,
  runValidation,
};
