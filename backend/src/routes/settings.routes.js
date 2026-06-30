const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.get);
router.put('/', authorize('superadmin', 'admin'), ctrl.update);

module.exports = router;
