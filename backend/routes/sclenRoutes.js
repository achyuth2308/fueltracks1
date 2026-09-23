const express = require('express');
const router  = express.Router();

const { getInformationByRTO } = require('../controllers/sclenController');

// SCLEN specific endpoint matching their legacy API structure exactly
router.post('/GET_INFORMATION_BY_RTO', getInformationByRTO);

module.exports = router;
