// tests/product.model.test.js
//
// Unit tests for the Product Mongoose model.
// Database connection and collection cleanup are handled by testDbSetup.js
// via Jest's setupFilesAfterEnv. Do not add connection logic here.

const { Product, CATEGORIES } = require("../src/models/Product");

// ---------------------------------------------------------------------------
// Helper — a minimal valid product body. Tests override individual fields.
// ---------------------------------------------------------------------------
const validProduct = (overrides = {}) => ({
  name: "Test Widget",
  sku: "TW-001",
  category: "Electronics",
  sellingPrice: 9.99,
  quantity: 10,
  minStockLevel: 5,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------
describe("Required fields", () => {
  test("saves successfully with all required fields", async () => {
    const product = await Product.create(validProduct());
    expect(product._id).toBeDefined();
    expect(product.name).toBe("Test Widget");
  });

  test.each(["name", "sku", "category", "sellingPrice", "quantity"])(
    "rejects a product missing required field: %s",
    async (field) => {
      const body = validProduct();
      delete body[field];
      await expect(Product.create(body)).rejects.toThrow();
    }
  );
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
describe("Defaults", () => {
  test("minStockLevel defaults to 5 when omitted", async () => {
    const body = validProduct();
    delete body.minStockLevel;
    const product = await Product.create(body);
    expect(product.minStockLevel).toBe(5);
  });

  test("supplier defaults to null when omitted", async () => {
    const product = await Product.create(validProduct());
    expect(product.supplier).toBeNull();
  });

  test("createdAt and updatedAt are set automatically", async () => {
    const product = await Product.create(validProduct());
    expect(product.createdAt).toBeInstanceOf(Date);
    expect(product.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Category enum
// ---------------------------------------------------------------------------
describe("Category validation", () => {
  test.each(CATEGORIES)(
    "accepts valid category: %s",
    async (category) => {
      const product = await Product.create(validProduct({ category }));
      expect(product.category).toBe(category);
    }
  );

  test("rejects an invalid category value", async () => {
    await expect(
      Product.create(validProduct({ category: "Furniture" }))
    ).rejects.toThrow();
  });

  test("rejects an empty string category", async () => {
    await expect(
      Product.create(validProduct({ category: "" }))
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// SKU normalization
// ---------------------------------------------------------------------------
describe("SKU normalization", () => {
  test("stores SKU in uppercase", async () => {
    const product = await Product.create(validProduct({ sku: "tw-abc" }));
    expect(product.sku).toBe("TW-ABC");
  });

  test("trims whitespace from SKU", async () => {
    const product = await Product.create(validProduct({ sku: "  TW-002  " }));
    expect(product.sku).toBe("TW-002");
  });

  test("uppercases and trims a mixed-case SKU with whitespace", async () => {
    const product = await Product.create(validProduct({ sku: "  tw-MiX  " }));
    expect(product.sku).toBe("TW-MIX");
  });
});

// ---------------------------------------------------------------------------
// SKU uniqueness
// ---------------------------------------------------------------------------
describe("SKU uniqueness", () => {
  beforeAll(async () => {
    // Ensure the unique index on `sku` is created in the test database
    // before any duplicate-key assertions run. Without this, Mongoose may
    // not have synchronized the index yet and the second insert could
    // succeed instead of throwing.
    await Product.init();
  });

  test("rejects a duplicate SKU (same case)", async () => {
    await Product.create(validProduct({ sku: "UNIQUE-001" }));
    await expect(
      Product.create(validProduct({ sku: "UNIQUE-001", name: "Other" }))
    ).rejects.toThrow();
  });

  test("rejects a duplicate SKU (different case — normalized to same value)", async () => {
    await Product.create(validProduct({ sku: "UNIQUE-002" }));
    await expect(
      Product.create(validProduct({ sku: "unique-002", name: "Other" }))
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sellingPrice validation
// ---------------------------------------------------------------------------
describe("sellingPrice validation", () => {
  test("accepts a positive finite price", async () => {
    const product = await Product.create(validProduct({ sellingPrice: 0.01 }));
    expect(product.sellingPrice).toBe(0.01);
  });

  test("rejects sellingPrice of zero", async () => {
    await expect(
      Product.create(validProduct({ sellingPrice: 0 }))
    ).rejects.toThrow();
  });

  test("rejects a negative sellingPrice", async () => {
    await expect(
      Product.create(validProduct({ sellingPrice: -1 }))
    ).rejects.toThrow();
  });

  test("rejects Infinity as sellingPrice", async () => {
    await expect(
      Product.create(validProduct({ sellingPrice: Infinity }))
    ).rejects.toThrow();
  });

  test("rejects NaN as sellingPrice", async () => {
    await expect(
      Product.create(validProduct({ sellingPrice: NaN }))
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// quantity validation
// ---------------------------------------------------------------------------
describe("quantity validation", () => {
  test("accepts zero quantity", async () => {
    const product = await Product.create(validProduct({ quantity: 0 }));
    expect(product.quantity).toBe(0);
  });

  test("accepts a positive integer quantity", async () => {
    const product = await Product.create(validProduct({ quantity: 100 }));
    expect(product.quantity).toBe(100);
  });

  test("rejects a negative quantity", async () => {
    await expect(
      Product.create(validProduct({ quantity: -1 }))
    ).rejects.toThrow();
  });

  test("rejects a non-integer quantity (decimal)", async () => {
    await expect(
      Product.create(validProduct({ quantity: 1.5 }))
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// minStockLevel validation
// ---------------------------------------------------------------------------
describe("minStockLevel validation", () => {
  test("accepts zero as minStockLevel", async () => {
    const product = await Product.create(validProduct({ minStockLevel: 0 }));
    expect(product.minStockLevel).toBe(0);
  });

  test("accepts a positive integer minStockLevel", async () => {
    const product = await Product.create(validProduct({ minStockLevel: 20 }));
    expect(product.minStockLevel).toBe(20);
  });

  test("rejects a negative minStockLevel", async () => {
    await expect(
      Product.create(validProduct({ minStockLevel: -1 }))
    ).rejects.toThrow();
  });

  test("rejects a non-integer minStockLevel (decimal)", async () => {
    await expect(
      Product.create(validProduct({ minStockLevel: 2.5 }))
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isLowStock virtual
// ---------------------------------------------------------------------------
describe("isLowStock virtual", () => {
  test("is false when quantity is above minStockLevel", async () => {
    const product = await Product.create(
      validProduct({ quantity: 10, minStockLevel: 5 })
    );
    expect(product.isLowStock).toBe(false);
  });

  test("is true when quantity equals minStockLevel", async () => {
    const product = await Product.create(
      validProduct({ quantity: 5, minStockLevel: 5 })
    );
    expect(product.isLowStock).toBe(true);
  });

  test("is true when quantity is below minStockLevel", async () => {
    const product = await Product.create(
      validProduct({ quantity: 2, minStockLevel: 5 })
    );
    expect(product.isLowStock).toBe(true);
  });

  test("is true when quantity is zero", async () => {
    const product = await Product.create(
      validProduct({ quantity: 0, minStockLevel: 5 })
    );
    expect(product.isLowStock).toBe(true);
  });

  test("is false when minStockLevel is zero and quantity is above zero", async () => {
    const product = await Product.create(
      validProduct({ quantity: 1, minStockLevel: 0 })
    );
    expect(product.isLowStock).toBe(false);
  });

  test("is true when both quantity and minStockLevel are zero", async () => {
    const product = await Product.create(
      validProduct({ quantity: 0, minStockLevel: 0 })
    );
    expect(product.isLowStock).toBe(true);
  });

  test("isLowStock is included in toJSON output", async () => {
    const product = await Product.create(
      validProduct({ quantity: 3, minStockLevel: 5 })
    );
    const json = product.toJSON();
    expect(json).toHaveProperty("isLowStock", true);
  });
});
