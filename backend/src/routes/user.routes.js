const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('superadmin', 'admin'), ctrl.getAll);
router.get('/:id', authorize('superadmin', 'admin'), ctrl.getById);
router.post('/', authorize('superadmin', 'admin'), ctrl.create);
router.put('/:id', authorize('superadmin', 'admin'), ctrl.update);
router.delete('/:id', authorize('superadmin'), ctrl.remove);

// Permissions tab: grant/manage login access for existing members
router.post('/grant-access', authorize('superadmin', 'admin'), ctrl.grantAccess);
router.patch('/:id/role', authorize('superadmin', 'admin'), ctrl.updateRole);
router.delete('/:id/access', authorize('superadmin', 'admin'), ctrl.revokeAccess);
router.patch('/:id/reset-password', authorize('superadmin'), ctrl.resetPassword);

module.exports = router;
