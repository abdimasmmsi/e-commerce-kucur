const createStoreController = (storeService) => ({
  list: async (req, res, next) => { try { res.json({ data: await storeService.listFor(req.auth.user) }); } catch (error) { next(error); } },
  get: async (req, res, next) => { try { res.json({ data: await storeService.get(String(req.params.storeId), req.auth.user) }); } catch (error) { next(error); } },
  create: async (req, res, next) => { try { res.status(201).json({ data: await storeService.create(req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  update: async (req, res, next) => { try { res.json({ data: await storeService.update(req.store, req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  availability: async (req, res, next) => { try { res.json({ data: await storeService.setAvailability(req.store, req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
  applications: async (req, res, next) => { try { res.json({ data: await storeService.listApplications(req.auth.user) }); } catch (error) { next(error); } },
  application: async (req, res, next) => { try { res.json({ data: await storeService.getApplication(String(req.params.storeId), req.auth.user) }); } catch (error) { next(error); } },
  reviewApplication: async (req, res, next) => { try { res.json({ data: await storeService.reviewApplication(String(req.params.storeId), req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
});

module.exports = { createStoreController };
