const createSettingsController = (settingsService) => ({
  get: async (req, res, next) => { try { res.json({ data: await settingsService.get() }); } catch (error) { next(error); } },
  update: async (req, res, next) => { try { res.json({ data: await settingsService.update(req.body || {}, req.auth.user) }); } catch (error) { next(error); } },
});

module.exports = { createSettingsController };
