/**
 * Created by avnee on 05-09-2018.
 */
'use-strict';

const express = require('express');
const router = express.Router();

const config = require('../Config');
const BreakPromiseChainError = require('../cread/utils/BreakPromiseChainError');

router.get('/update', (request, response) => {

    let connection;

    config.getNewConnection()
        .then(conn => {
            connection = conn;

            connection.query('', [], (err, rows) => {

            })

        })

});

function updateData(connection) {

}

module.exports = router;