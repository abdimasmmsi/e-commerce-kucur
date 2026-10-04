const createAuthController = (authService) => ({
  register: async (req, res, next) => { try { res.status(201).json({ data: await authService.register(req.body || {}) }); } catch (error) { next(error); } },
  login: async (req, res, next) => { try { res.json({ data: await authService.login(req.body || {}) }); } catch (error) { next(error); } },
  me: (req, res) => res.json({ data: req.auth.user }),
  logout: async (req, res, next) => { try { await authService.revoke(req.auth.token); res.status(204).end(); } catch (error) { next(error); } },
});

module.exports = { createAuthController };
