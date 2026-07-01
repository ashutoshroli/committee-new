const router = require('express').Router();
const ctrl = require('../controllers/loanRequest.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Any authenticated user (member) can view relevant requests and submit/revoke their own
router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.revoke);

// Admin-only review, allocation and distribution
router.patch('/:id/approve', authorize('superadmin', 'admin'), ctrl.approve);
router.patch('/:id/reject', authorize('superadmin', 'admin'), ctrl.reject);
router.post('/allocate', authorize('superadmin', 'admin'), ctrl.allocate);
router.post('/distribute', authorize('superadmin', 'admin'), ctrl.distribute);

module.exports = router;
