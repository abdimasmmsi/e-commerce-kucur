const { errors } = require("../errors/AppError");
const { setReadContextUser } = require("../repositories/repositoryReadContext");

const bearerToken = (header) => {
  const match = /^Bearer\s+(.+)$/i.exec(String(header || ""));
  return match?.[1] || null;
};

const createAuthMiddleware = (authService) => {
  const requireAuth = async (req, res, next) => {
    void res;
    const token = bearerToken(req.headers.authorization);
    const user = token && await authService.authenticate(token);
    if (!user) return next(errors.unauthenticated());
    setReadContextUser(user.id);
    req.auth = { user, token };
    return next();
  };
  const requireRole = (...allowedRoles) => (req, res, next) => {
    void res;
    if (!allowedRoles.some((role) => req.auth.user.roles.includes(role))) return next(errors.forbidden());
    return next();
  };
  const optionalAuth = async (req, res, next) => {
    void res;
    const token = bearerToken(req.headers.authorization);
    const user = token && await authService.authenticate(token);
    if (user) { setReadContextUser(user.id); req.auth = { user, token }; }
    return next();
  };
  const requireStoreOwnership = (repository) => async (req, res, next) => {
    void res;
    const store = await repository.stores.findById(String(req.params.storeId));
    if (!store) return next(errors.notFound("Store tidak ditemukan."));
    if (store.merchantUserId !== req.auth.user.id && !req.auth.user.roles.includes("admin")) return next(errors.forbidden("Store bukan milik pengguna ini."));
    req.store = store;
    return next();
  };
  return { requireAuth, optionalAuth, requireRole, requireStoreOwnership };
};

module.exports = { createAuthMiddleware };
