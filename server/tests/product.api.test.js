// tests/product.api.test.js
//
// Integration tests for the Product REST API.
// Database connection and per-test cleanup are handled by testDbSetup.js
// via Jest's setupFilesAfterEnv. Do not add connection logic here.

const request = require("supertest");
const app = require("../src/server");
const { Product } = require("../src/models/Product");

// ---------------------------------------------------------------------------
// Helper — a minimal valid product body. Tests override individual fields.
// ---------------------------------------------------------------------------
const validBody = (overrides = {}) => ({
  name: "Test Widget",
  sku: "API-001",
  category: "Electronics",
  sellingPrice: 9.99,
  quantity: 10,
  minStockLevel: 5,
  ...overrides,
});

// ---------------------------------------------------------------------------
// 1. GET /api/products — list and pagination
// ---------------------------------------------------------------------------
describe("GET /api/products", () => {
  test("returns 200 with empty data array and correct meta when no products exist", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  test("returns all products with correct meta totals", async () => {
    await Product.create(validBody({ sku: "LIST-001" }));
    await Product.create(validBody({ sku: "LIST-002" }));
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  test("respects pageSize and returns correct meta", async () => {
    await Product.create(validBody({ sku: "PG-001" }));
    await Product.create(validBody({ sku: "PG-002" }));
    await Product.create(validBody({ sku: "PG-003" }));
    const res = await request(app).get("/api/products?pageSize=2&page=1");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 2,
      totalPages: 2,
    });
  });

  test("returns second page correctly", async () => {
    await Product.create(validBody({ sku: "PG2-001" }));
    await Product.create(validBody({ sku: "PG2-002" }));
    await Product.create(validBody({ sku: "PG2-003" }));
    const res = await request(app).get("/api/products?pageSize=2&page=2");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.page).toBe(2);
  });

  test("returns 400 for invalid pageSize value", async () => {
    const res = await request(app).get("/api/products?pageSize=200");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  test("returns 400 for invalid category query parameter", async () => {
    const res = await request(app).get("/api/products?category=Furniture");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/products/:id
// ---------------------------------------------------------------------------
describe("GET /api/products/:id", () => {
  test("returns 200 and the product for a valid existing ID", async () => {
    const product = await Product.create(validBody({ sku: "GET-001" }));
    const res = await request(app).get(`/api/products/${product._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sku).toBe("GET-001");
  });

  test("returns 400 for a malformed (non-ObjectId) ID", async () => {
    const res = await request(app).get("/api/products/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid product ID format");
  });

  test("returns 404 for a valid ObjectId that does not exist", async () => {
    const res = await request(app).get(
      "/api/products/000000000000000000000001"
    );
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Product not found");
  });
});

// ---------------------------------------------------------------------------
// 3. POST /api/products — valid creation
// ---------------------------------------------------------------------------
describe("POST /api/products — valid creation", () => {
  test("creates a product and returns 201 with the saved document", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "NEW-001" }));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.sku).toBe("NEW-001");
    expect(res.body.data.name).toBe("Test Widget");
  });

  test("normalizes SKU to uppercase before storing", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "new-002" }));
    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe("NEW-002");
  });

  test("applies minStockLevel default of 5 when omitted", async () => {
    const body = validBody({ sku: "NEW-003" });
    delete body.minStockLevel;
    const res = await request(app).post("/api/products").send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.minStockLevel).toBe(5);
  });

  test("includes isLowStock virtual in the response", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "NEW-004", quantity: 3, minStockLevel: 5 }));
    expect(res.status).toBe(201);
    expect(res.body.data.isLowStock).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. POST /api/products — validation errors
// ---------------------------------------------------------------------------
describe("POST /api/products — validation errors", () => {
  test.each(["name", "sku", "category", "sellingPrice", "quantity"])(
    "returns 400 when required field is missing: %s",
    async (field) => {
      const body = validBody({ sku: `MISS-${field}`.toUpperCase() });
      delete body[field];
      const res = await request(app).post("/api/products").send(body);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors.length).toBeGreaterThan(0);
    }
  );

  test("returns 400 for an invalid category", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-CAT", category: "Furniture" }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors[0].field).toBe("category");
  });

  test("returns 400 when sellingPrice is zero", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-SP1", sellingPrice: 0 }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors[0].field).toBe("sellingPrice");
  });

  test("returns 400 when sellingPrice is negative", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-SP2", sellingPrice: -1 }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("sellingPrice");
  });

  test("returns 400 when sellingPrice is a string", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-SP3", sellingPrice: "9.99" }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("sellingPrice");
  });

  test('returns 400 when sellingPrice is the string "Infinity"', async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-SP4", sellingPrice: "Infinity" }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors[0].field).toBe("sellingPrice");
  });

  test("returns 400 when quantity is negative", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-QT1", quantity: -1 }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("quantity");
  });

  test("returns 400 when quantity is a decimal", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-QT2", quantity: 1.5 }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("quantity");
  });

  test("returns 400 when quantity is a string", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-QT3", quantity: "10" }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("quantity");
  });

  test("returns 400 when minStockLevel is negative", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-MSL1", minStockLevel: -1 }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("minStockLevel");
  });

  test("returns 400 when minStockLevel is a decimal", async () => {
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "VAL-MSL2", minStockLevel: 2.5 }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("minStockLevel");
  });
});

// ---------------------------------------------------------------------------
// 5. POST /api/products — duplicate SKU
// ---------------------------------------------------------------------------
describe("POST /api/products — duplicate SKU", () => {
  beforeAll(async () => {
    // Ensure the unique index on `sku` is created in the test database
    // before any duplicate-key assertions run.
    await Product.init();
  });

  test("returns 409 for an exact duplicate SKU", async () => {
    const first = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "DUP-001" }));
    expect(first.status).toBe(201);
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "DUP-001", name: "Other" }));
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("DUP-001");
  });

  test("returns 409 for a duplicate SKU differing only in case", async () => {
    const first = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "DUP-002" }));
    expect(first.status).toBe(201);
    const res = await request(app)
      .post("/api/products")
      .send(validBody({ sku: "dup-002", name: "Other" }));
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("DUP-002");
  });
});

// ---------------------------------------------------------------------------
// 6. GET /api/products — search
// ---------------------------------------------------------------------------
describe("GET /api/products — search", () => {
  beforeEach(async () => {
    await Product.create(validBody({ sku: "SRCH-001", name: "Blue Notebook" }));
    await Product.create(
      validBody({ sku: "SRCH-002", name: "Red Pen", category: "Stationery" })
    );
  });

  test("finds products by partial name match (case-insensitive)", async () => {
    const res = await request(app).get("/api/products?search=notebook");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Blue Notebook");
  });

  test("finds products by partial SKU match", async () => {
    const res = await request(app).get("/api/products?search=SRCH-002");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sku).toBe("SRCH-002");
  });

  test("returns empty array when search matches nothing", async () => {
    const res = await request(app).get("/api/products?search=zzznomatch");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test("returns 400 for a search term exceeding 100 characters", async () => {
    const long = "a".repeat(101);
    const res = await request(app).get(`/api/products?search=${long}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });
});

// ---------------------------------------------------------------------------
// 7. GET /api/products — category filter
// ---------------------------------------------------------------------------
describe("GET /api/products — category filter", () => {
  beforeEach(async () => {
    await Product.create(
      validBody({ sku: "CAT-001", category: "Electronics" })
    );
    await Product.create(
      validBody({ sku: "CAT-002", category: "Clothing" })
    );
    await Product.create(
      validBody({ sku: "CAT-003", category: "Electronics" })
    );
  });

  test("returns only products matching the requested category", async () => {
    const res = await request(app).get("/api/products?category=Electronics");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(
      res.body.data.every((p) => p.category === "Electronics")
    ).toBe(true);
  });

  test("returns empty array when no products match the category", async () => {
    const res = await request(app).get("/api/products?category=Food");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. GET /api/products — low-stock filter
// ---------------------------------------------------------------------------
describe("GET /api/products — low-stock filter", () => {
  beforeEach(async () => {
    // quantity < minStockLevel → low stock
    await Product.create(
      validBody({ sku: "LS-001", quantity: 3, minStockLevel: 5 })
    );
    // quantity === minStockLevel → low stock (boundary)
    await Product.create(
      validBody({ sku: "LS-002", quantity: 5, minStockLevel: 5 })
    );
    // quantity > minStockLevel → not low stock
    await Product.create(
      validBody({ sku: "LS-003", quantity: 10, minStockLevel: 5 })
    );
  });

  test("returns only low-stock products when lowStock=true", async () => {
    const res = await request(app).get("/api/products?lowStock=true");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(
      res.body.data.every((p) => p.quantity <= p.minStockLevel)
    ).toBe(true);
  });

  test("returns all products when lowStock=false", async () => {
    const res = await request(app).get("/api/products?lowStock=false");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  test("returns 400 for an invalid lowStock value", async () => {
    const res = await request(app).get("/api/products?lowStock=yes");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });
});

// ---------------------------------------------------------------------------
// 9. PUT /api/products/:id
// ---------------------------------------------------------------------------
describe("PUT /api/products/:id", () => {
  test("updates allowed fields and returns the updated product", async () => {
    const product = await Product.create(validBody({ sku: "UPD-001" }));
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .send({ name: "Updated Name", sellingPrice: 19.99 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Updated Name");
    expect(res.body.data.sellingPrice).toBe(19.99);
    expect(res.body.data.sku).toBe("UPD-001"); // SKU unchanged
  });

  test("returns 400 for a malformed ID", async () => {
    const res = await request(app)
      .put("/api/products/not-an-id")
      .send({ name: "X" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid product ID format");
  });

  test("returns 404 for a valid ObjectId that does not exist", async () => {
    const res = await request(app)
      .put("/api/products/000000000000000000000001")
      .send({ name: "X" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });

  test("returns 400 when SKU is included in the request body", async () => {
    const product = await Product.create(validBody({ sku: "UPD-002" }));
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .send({ sku: "NEW-SKU" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "SKU cannot be changed after a product is created"
    );
  });

  test("returns 400 when the body contains no updatable fields", async () => {
    const product = await Product.create(validBody({ sku: "UPD-003" }));
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No updatable fields provided");
  });

  test("returns 400 when sellingPrice is updated to zero", async () => {
    const product = await Product.create(validBody({ sku: "UPD-004" }));
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .send({ sellingPrice: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors[0].field).toBe("sellingPrice");
  });

  test("returns 400 when quantity is updated to a decimal", async () => {
    const product = await Product.create(validBody({ sku: "UPD-005" }));
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .send({ quantity: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("quantity");
  });
});

// ---------------------------------------------------------------------------
// 10. DELETE /api/products/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/products/:id", () => {
  test("deletes the product and returns 200 with success message", async () => {
    const product = await Product.create(validBody({ sku: "DEL-001" }));
    const res = await request(app).delete(`/api/products/${product._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product deleted");
  });

  test("product is no longer retrievable after deletion", async () => {
    const product = await Product.create(validBody({ sku: "DEL-002" }));
    await request(app).delete(`/api/products/${product._id}`);
    const res = await request(app).get(`/api/products/${product._id}`);
    expect(res.status).toBe(404);
  });

  test("returns 400 for a malformed ID", async () => {
    const res = await request(app).delete("/api/products/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid product ID format");
  });

  test("returns 404 for a valid ObjectId that does not exist", async () => {
    const res = await request(app).delete(
      "/api/products/000000000000000000000001"
    );
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });
});
