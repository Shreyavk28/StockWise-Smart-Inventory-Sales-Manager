# StockWise — Smart Inventory & Sales Manager

StockWise is a full-stack inventory and sales management application built using the MERN stack. It helps businesses manage products, monitor stock levels, record sales, track stock movements, and identify low-stock items through a dashboard.

## Features

### Dashboard
- View key inventory and sales statistics.
- Monitor total products, stock levels, and sales activity.
- View recent sales and top-selling products.
- Identify low-stock and out-of-stock products.

### Product Management
- Create, view, update, and delete products.
- Store product details, including name, SKU, category, selling price, quantity, supplier, and minimum stock level.
- Search products and filter by category.
- Filter low-stock products.
- Support pagination for product listings.
- Automatically normalize SKUs to uppercase and prevent duplicate SKUs.

### Sales Management
- Record sales by selecting a product and quantity.
- Calculate the sale total using the product's stored selling price.
- Automatically deduct sold quantities from inventory.
- Maintain sales history and individual sale details.
- Prevent sales when sufficient stock is unavailable.

### Stock Movement Tracking
- Record stock additions and manual stock adjustments.
- Track stock-in and stock-out movements.
- Record movement reasons and timestamps.
- Maintain a history of inventory changes.

### Inventory Safety
- Use MongoDB transactions for operations that update multiple related records.
- Prevent inventory quantities from becoming negative during sales.
- Use database validation and centralized error handling.
- Enforce SKU uniqueness at the database level.

## Technology Stack

### Frontend
- React.js
- Vite
- JavaScript
- HTML5
- CSS3

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- REST API

### Testing and Development
- Jest
- Supertest
- Git and GitHub
- Kiro IDE
- MongoDB Atlas

## Project Structure

```text
StockWise/
├── client/
│   ├── public/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.js
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- MongoDB Atlas account or a compatible MongoDB deployment
- Git

**Important:** MongoDB transactions require a replica set or sharded cluster. A standalone MongoDB server does not support the transaction setup used by this application.

## Installation and Setup

### 1. Clone the repository

Replace `YOUR_USERNAME` with your GitHub username after publishing the repository.

```bash
git clone https://github.com/YOUR_USERNAME/StockWise.git
cd StockWise
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server/` directory using `.env.example` as a reference.

Configure the required environment variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

Replace the example database value with your own MongoDB connection string. Never commit your actual `.env` file or share database credentials publicly.

Start the backend development server:

```bash
npm run dev
```

The backend runs at:

`http://localhost:5000`

Health check:

`http://localhost:5000/api/health`

### 3. Set up the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL displayed by Vite, typically:

`http://localhost:5173`

The frontend uses the Vite development proxy to communicate with the backend through `/api`.

## API Overview

The backend exposes REST API endpoints under `/api`.

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check backend health |

### Products

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List products with search, filters, and pagination |
| GET | `/api/products/:id` | Get a product by ID |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |

Supported product listing query parameters include `search`, `category`, `lowStock`, `page`, and `pageSize`.

SKU values are normalized to uppercase, and duplicate SKUs return a conflict response. SKU changes are not permitted through the product update endpoint.

### Sales

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sales` | List sales with pagination |
| GET | `/api/sales/:id` | Get a sale by ID |
| POST | `/api/sales` | Record a sale and deduct inventory |

Sales are recorded using the current product price stored in the database. Inventory deduction, sale creation, and stock movement creation are handled in a MongoDB transaction.

### Stock Movements

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stock-movements` | List stock movements |
| GET | `/api/stock-movements/:id` | Get a stock movement by ID |
| POST | `/api/stock-movements/restock` | Add stock to a product |
| POST | `/api/stock-movements/adjust` | Adjust stock to the actual quantity |

Stock movement listing supports search, type, reason, and pagination filters.

## Testing

The backend uses Jest and Supertest for automated tests.

From the backend directory:

```bash
cd server
npm test
```

Integration tests should use a dedicated test database configured through `MONGODB_URI_TEST`. Never point destructive integration tests at your development or production database.

Example test environment variable:

```env
MONGODB_URI_TEST=your_dedicated_test_database_connection_string
```

Use a dedicated database named `stockwise-test` for integration testing, following the project's test configuration. Do not expose database credentials in logs or commit them to Git.

## Running the Application

Start the backend and frontend in separate terminals.

**Terminal 1 — Backend**

```bash
cd server
npm run dev
```

**Terminal 2 — Frontend**

```bash
cd client
npm run dev
```

Open the frontend URL shown in the terminal and confirm that the backend health endpoint is responding.

## AI-Assisted Development

Kiro was used as an AI-assisted development environment during the implementation of StockWise.

AI assistance supported development activities such as:

- Planning the application architecture and folder structure.
- Implementing REST API endpoints and validation.
- Developing inventory and sales workflows.
- Reviewing error handling and database transaction safety.
- Supporting frontend development and debugging.
- Improving documentation and test coverage.

AI-generated changes were reviewed and tested during development. The project was built iteratively, with attention to data consistency, input validation, and maintainable code.

## Security and Reliability

- Environment variables are used for database configuration.
- Secret files such as `.env` are excluded from version control.
- Product input is validated before database operations.
- Duplicate SKU errors are handled as HTTP conflict responses.
- Sale and stock updates use MongoDB transactions.
- Stock deductions check available inventory to prevent negative quantities.
- A centralized error-handling middleware standardizes API errors.
- Automated tests help verify expected API behavior.

## Future Improvements

Potential enhancements include:

- User authentication and role-based access control.
- Exportable inventory and sales reports.
- Supplier management.
- Barcode scanning.
- Sales trend analytics.
- Deployment with a managed database and hosted frontend.

## Author

**Shreya V K**

Computer Science and Engineering

GitHub: [Add your GitHub profile URL]

LinkedIn: [Add your LinkedIn profile URL]

## License

This project was developed as part of a software engineering internship assignment. A formal open-source license can be added if the project is intended for redistribution.