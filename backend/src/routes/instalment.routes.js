const router = require('express').Router();
const ctrl = require('../controllers/instalment.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/summary/:month/:year', ctrl.getMonthlySummary);
router.get('/member/:memberId', ctrl.getByMember);
router.post('/generate', authorize('superadmin', 'admin'), ctrl.generateMonthly);
router.post('/:id/pay', authorize('superadmin', 'admin', 'subadmin', 'manager'), ctrl.recordPayment);

module.exports = router;
