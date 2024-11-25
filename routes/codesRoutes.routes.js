const express = require('express');
const router = express.Router();
const {validateCredentials, getUserCodes, getWinners} = require('./controllers/codes.js');

router.post('/registerCode', validateCredentials);
router.post('/getUserCodes', getUserCodes);
router.get('/getWinners', getWinners);


module.exports = router;