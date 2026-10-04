const createProductController = (service) => ({
  list: async (req, res, next) => { try { res.json({ data: await service.list(req.auth?.user, req.query.scope === "manage", req.query) }); } catch (error) { next(error); } },
  get: async (req, res, next) => { try { res.json({ data: await service.get(String(req.params.productId), req.auth?.user, req.query.scope === "manage", req.query) }); } catch (error) { next(error); } },
  create: async (req, res, next) => { try { res.status(201).json({ data: await service.create(req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  update: async (req, res, next) => { try { res.json({ data: await service.update(String(req.params.productId), req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
});
module.exports = { createProductController };
