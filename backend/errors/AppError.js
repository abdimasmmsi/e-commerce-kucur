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
  tooManyRequests: (message = "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.", details) => new AppError("TOO_MANY_REQUESTS", message, 429, details),
};

module.exports = { AppError, errors };
