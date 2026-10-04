class AppError extends Error {
  constructor(code, message, statusCode = 500, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const errors = {
  unauthenticated: (message = "Autentikasi diperlukan.") => new AppError("UNAUTHENTICATED", message, 401),
  forbidden: (message = "Anda tidak memiliki izin untuk tindakan ini.") => new AppError("FORBIDDEN", message, 403),
  notFound: (message = "Data tidak ditemukan.") => new AppError("NOT_FOUND", message, 404),
  validation: (details, message = "Data yang dikirim tidak valid.") => new AppError("VALIDATION_ERROR", message, 400, details),
  conflict: (message) => new AppError("CONFLICT", message, 409),
};

module.exports = { AppError, errors };
