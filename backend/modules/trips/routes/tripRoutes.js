const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/',                      (req, res, next) => tripController.list(req, res, next));
router.post('/',                     (req, res, next) => tripController.create(req, res, next));
router.get('/active/:vehicleId',     (req, res, next) => tripController.getActive(req, res, next));
router.get('/:id',                   (req, res, next) => tripController.getOne(req, res, next));
router.post('/:id/start',            (req, res, next) => tripController.start(req, res, next));
router.post('/:id/end',              (req, res, next) => tripController.end(req, res, next));
router.delete('/:id',                (req, res, next) => tripController.cancel(req, res, next));

module.exports = router;
