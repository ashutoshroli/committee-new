const router = require('express').Router();
const ctrl = require('../controllers/loan.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/preview', ctrl.preview);
router.get('/:id', ctrl.getById);
router.get('/:id/schedule', ctrl.getSchedule);
router.get('/:id/payments', ctrl.getPayments);
router.post('/', authorize('superadmin', 'admin', 'subadmin'), ctrl.create);
router.post('/:id/payment', authorize('superadmin', 'admin', 'subadmin', 'manager'), ctrl.makePayment);
router.post('/:id/foreclose', authorize('superadmin', 'admin'), ctrl.foreclose);
router.post('/process-monthly-interest', authorize('superadmin', 'admin'), ctrl.processMonthlyInterest);

module.exports = router;
