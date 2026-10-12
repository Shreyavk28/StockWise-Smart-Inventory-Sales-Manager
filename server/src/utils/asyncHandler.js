/**
 * Wraps an async Express route handler so that any rejected promise is
 * forwarded to Express's next(err) rather than becoming an unhandled
 * rejection.
 *
 * Usage:
 *   router.get("/", asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
