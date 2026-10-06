const createProductController = (service) => ({
  recordView: async (req, res, next) => { try { res.json({ data: await service.recordView(String(req.params.productId)) }); } catch (error) { next(error); } },
  restockStatus: async (req, res, next) => { try { res.json({ data: await service.restockStatus(String(req.params.productId), req.auth.user) }); } catch (error) { next(error); } },
  watchRestock: async (req, res, next) => { try { res.json({ data: await service.setRestockWatch(String(req.params.productId), req.auth.user, true) }); } catch (error) { next(error); } },
  unwatchRestock: async (req, res, next) => { try { res.json({ data: await service.setRestockWatch(String(req.params.productId), req.auth.user, false) }); } catch (error) { next(error); } },
  storeViews: async (req, res, next) => { try { res.json({ data: await service.storeViews(String(req.params.storeId), req.auth.user) }); } catch (error) { next(error); } },
  list: async (req, res, next) => { try { res.json({ data: await service.list(req.auth?.user, req.query.scope === "manage", req.query) }); } catch (error) { next(error); } },
  get: async (req, res, next) => { try { res.json({ data: await service.get(String(req.params.productId), req.auth?.user, req.query.scope === "manage", req.query) }); } catch (error) { next(error); } },
  create: async (req, res, next) => { try { res.status(201).json({ data: await service.create(req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  update: async (req, res, next) => { try { res.json({ data: await service.update(String(req.params.productId), req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
});
module.exports = { createProductController };
