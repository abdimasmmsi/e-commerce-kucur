const createUserController = (userService) => ({
  createCourier: async (req, res, next) => { try { res.status(201).json({ data: await userService.createCourier(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
  list: async (req, res, next) => { try { res.json({ data: await userService.listUsers(req.auth.user) }); } catch (error) { next(error); } },
  updateProfile: async (req, res, next) => { try { res.json({ data: await userService.updateProfile(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
  updateAvatar: async (req, res, next) => { try { res.json({ data: await userService.updateAvatar(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
  removeAvatar: async (req, res, next) => { try { res.json({ data: await userService.removeAvatar(req.auth.user) }); } catch (error) { next(error); } },
  verifyCurrentPassword: async (req, res, next) => { try { res.json({ data: await userService.verifyCurrentPassword(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
  updatePassword: async (req, res, next) => { try { res.json({ data: await userService.updatePassword(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
  updateAddresses: async (req, res, next) => { try { res.json({ data: await userService.updateAddresses(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
    updatePreferences: async (req, res, next) => { try { res.json({ data: await userService.updatePreferences(req.auth.user, req.body || {}) }); } catch (error) { next(error); } },
  adminResetPassword: async (req, res, next) => { try { res.json({ data: await userService.adminResetPassword(req.auth.user, String(req.params.userId), req.body || {}) }); } catch (error) { next(error); } },
});
module.exports = { createUserController };
