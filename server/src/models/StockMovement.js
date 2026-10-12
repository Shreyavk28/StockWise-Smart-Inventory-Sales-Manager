
const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    // Snapshots preserve readable history if the product is deleted.
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

    type: {
      type: String,
      required: [true, "Movement type is required"],
      enum: {
        values: ["IN", "OUT"],
        message: "Movement type must be IN or OUT",
      },
    },

    quantity: {
      type: Number,
      required: [true, "Movement quantity is required"],
      validate: [
        {
          validator: Number.isInteger,
          message: "Movement quantity must be a whole number",
        },
        {
          validator: (value) => value > 0,
          message: "Movement quantity must be greater than zero",
        },
      ],
    },

    reason: {
      type: String,
      required: [true, "Movement reason is required"],
      enum: {
        values: ["SALE", "RESTOCK", "ADJUSTMENT"],
        message: "Invalid stock movement reason",
      },
    },

    reference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Display recent stock changes first.
stockMovementSchema.index({ createdAt: -1 });

const StockMovement = mongoose.model(
  "StockMovement",
  stockMovementSchema
);

module.exports = { StockMovement };
