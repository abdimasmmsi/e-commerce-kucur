const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");

const storage = new AsyncLocalStorage();
const currentReadContext = () => storage.getStore() || null;
const setReadContextUser = (userId) => { const context = storage.getStore(); if (context && userId) context.userId = String(userId); };
const readContextMiddleware = (req, res, next) => {
  const requestId = String(req.headers["x-request-id"] || randomUUID()).slice(0, 100);
  res.setHeader("x-request-id", requestId);
  storage.run({ requestId, userId: null, path: req.originalUrl || req.path || "" }, next);
};

module.exports = { currentReadContext, readContextMiddleware, setReadContextUser };
