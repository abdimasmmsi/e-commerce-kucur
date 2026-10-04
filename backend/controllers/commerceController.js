const createCartController = (service) => ({
  get: async (req, res, next) => { try { res.json({ data: await service.get(req.auth.user) }); } catch (error) { next(error); } },
  add: async (req, res, next) => { try { res.status(201).json({ data: await service.add(req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  update: async (req, res, next) => { try { res.json({ data: await service.update(String(req.params.cartItemId), req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  remove: async (req, res, next) => { try { res.json({ data: await service.remove(String(req.params.cartItemId), req.auth.user) }); } catch (error) { next(error); } },
});
const createCheckoutController = (service) => ({
  preview: async (req, res, next) => { try { res.json({ data: await service.preview(req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  create: async (req, res, next) => { try { res.status(201).json({ data: await service.create(req.body || {}, req.auth.user, req.get("Idempotency-Key")) }); } catch (error) { next(error); } },
});
const createOrderController = (service) => ({
  list: async (req, res, next) => { try { res.json({ data: await service.list(req.auth.user, req.query || {}) }); } catch (error) { next(error); } },
  get: async (req, res, next) => { try { res.json({ data: await service.get(String(req.params.orderId), req.auth.user) }); } catch (error) { next(error); } },
  transition: async (req, res, next) => { try { res.json({ data: await service.transition(String(req.params.orderId), req.body?.status, req.auth.user) }); } catch (error) { next(error); } },
  cancel: async (req, res, next) => { try { res.json({ data: await service.cancel(String(req.params.orderId), req.body?.reason, req.auth.user) }); } catch (error) { next(error); } },
});
module.exports = { createCartController, createCheckoutController, createOrderController };
