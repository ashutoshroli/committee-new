const router = require('express').Router();
const ctrl = require('../controllers/activity.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Activity log is visible only to superadmin
router.get('/', authorize('superadmin'), ctrl.getAll);

module.exports = router;
