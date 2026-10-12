
const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true,
    },

    // Keep snapshots so sales history remains readable
    // even if the original product is later deleted.
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name must be 200 characters or fewer"],
    },

    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      uppercase: true,
      maxlength: [100, "SKU must be 100 characters or fewer"],
    },

    quantity: {
      type: Number,
      required: [true, "Sale quantity is required"],
      validate: [
        {
          validator: Number.isInteger,
          message: "Sale quantity must be a whole number",
        },
        {
          validator: (value) => value > 0,
          message: "Sale quantity must be greater than zero",
        },
      ],
    },

    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      validate: {
        validator: (value) =>
          Number.isFinite(value) && value > 0,
        message: "Unit price must be a finite number greater than zero",
      },
    },

    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      validate: {
        validator: (value) =>
          Number.isFinite(value) && value > 0,
        message: "Total amount must be a finite number greater than zero",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Useful for retrieving recent sales first.
saleSchema.index({ createdAt: -1 });

const Sale = mongoose.model("Sale", saleSchema);

module.exports = { Sale };
