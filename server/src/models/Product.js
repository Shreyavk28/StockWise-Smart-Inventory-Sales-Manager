
const mongoose = require("mongoose");

// Valid product categories — shared by the schema and validation middleware.
const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Food",
  "Stationery",
  "Other",
];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name must be 200 characters or fewer"],
    },

    // SKU is normalized to uppercase and trimmed.
    // SKU remains immutable after product creation.
    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      maxlength: [100, "SKU must be 100 characters or fewer"],
      uppercase: true,
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: CATEGORIES,
        message: `Category must be one of: ${CATEGORIES.join(", ")}`,
      },
    },

    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      validate: [
        {
          validator: (value) => Number.isFinite(value),
          message: "Selling price must be a finite number",
        },
        {
          validator: (value) => value > 0,
          message: "Selling price must be greater than zero",
        },
      ],
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      validate: [
        {
          validator: Number.isInteger,
          message: "Quantity must be a whole number",
        },
        {
          validator: (value) => value >= 0,
          message: "Quantity cannot be negative",
        },
      ],
    },

    supplier: {
      type: String,
      trim: true,
      maxlength: [200, "Supplier name must be 200 characters or fewer"],
      default: null,
    },

    minStockLevel: {
      type: Number,
      required: [true, "Minimum stock level is required"],
      default: 5,
      validate: [
        {
          validator: Number.isInteger,
          message: "Minimum stock level must be a whole number",
        },
        {
          validator: (value) => value >= 0,
          message: "Minimum stock level cannot be negative",
        },
      ],
    },
  },
  {
    timestamps: true,

    // Include virtual fields in API JSON responses and plain objects.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

// Enforce unique SKU values at the database level.
productSchema.index({ sku: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// Virtual fields
// ---------------------------------------------------------------------------

// Compatibility virtual: true when quantity is at or below minimum stock.
// This includes products with quantity 0.
productSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.minStockLevel;
});

// Authoritative three-state stock status for the frontend and API consumers.
productSchema.virtual("stockStatus").get(function () {
  if (this.quantity <= 0) {
    return "out-of-stock";
  }

  if (this.quantity <= this.minStockLevel) {
    return "low-stock";
  }

  return "in-stock";
});

// ---------------------------------------------------------------------------
// Pre-save hook — normalize SKU
// ---------------------------------------------------------------------------

productSchema.pre("save", function (next) {
  if (this.isModified("sku") && typeof this.sku === "string") {
    this.sku = this.sku.toUpperCase().trim();
  }

  next();
});

// findOneAndUpdate does not execute pre-save hooks.
// SKU updates are rejected by the controller, so SKU normalization
// is handled during product creation.

const Product = mongoose.model("Product", productSchema);

module.exports = {
  Product,
  CATEGORIES,
};
