const { AppError } = require("../errors/AppError");

function notFoundHandler(req, res) {
  res.status(404).json({ code: "NOT_FOUND", message: "Endpoint tidak ditemukan.", details: { method: req.method, path: req.path } });
}

function errorHandler(error, req, res, next) {
  void req; void next;
  if (error?.code === "P2002") error = new AppError("CONFLICT", "Data dengan nilai unik tersebut sudah tersedia.", 409);
  else if (error?.code === "P2003") error = new AppError("VALIDATION_ERROR", "Relasi data tidak valid.", 400);
  else if (error?.code === "P2025") error = new AppError("NOT_FOUND", "Data tidak ditemukan.", 404);
  else if (String(error?.code || "").startsWith("P1")) error = new AppError("DATABASE_UNAVAILABLE", "Database tidak tersedia.", 503);
  const known = error instanceof AppError || Number.isInteger(error.statusCode);
  const status = known ? error.statusCode : 500;
  if (!known) console.error(error);
  res.status(status).json({
    code: known ? error.code || "INTERNAL_ERROR" : "INTERNAL_ERROR",
    message: known ? error.message : "Terjadi kesalahan pada server.",
    ...(known && error.details ? { details: error.details } : {}),
    ...(known && error.provider ? { provider: error.provider } : {}),
  });
}

module.exports = { errorHandler, notFoundHandler };
