const router = require('express').Router();
const ctrl = require('../controllers/member.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('superadmin', 'admin', 'subadmin'), ctrl.create);
router.put('/:id', authorize('superadmin', 'admin', 'subadmin'), ctrl.update);
router.delete('/:id', authorize('superadmin', 'admin'), ctrl.remove);

module.exports = router;
