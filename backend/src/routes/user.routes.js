const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('superadmin', 'admin'), ctrl.getAll);
router.get('/:id', authorize('superadmin', 'admin'), ctrl.getById);
router.post('/', authorize('superadmin', 'admin'), ctrl.create);
router.put('/:id', authorize('superadmin', 'admin'), ctrl.update);
router.delete('/:id', authorize('superadmin'), ctrl.remove);

module.exports = router;
