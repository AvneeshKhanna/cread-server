/**
 * Created by avnee on 31-08-2017.
 */
'use strict';

var config = require('../../Config');

/**
 * Function to add a user's share's details to the database
 * */
function saveShareToDb(params, connection) {

    return new Promise(function (resolve, reject) {

        if (!connection) {
            connection = config.createConnection;
        }

        connection.query('INSERT INTO Share SET ?', params, function (error, data) {

            if (error) {
                reject(error);
            }
            else {
                console.log('Query executed');
                resolve();
            }

        });

    });

}

module.exports = {
    saveShareToDb: saveShareToDb
};