/**
 * Created by avnee on 12-10-2017.
 */

/**
 * Handles functionalities regarding hats-off system
 * */
'use-strict';
var uuidGenerator = require('uuid');
var utils = require('../utils/Utils');


var moment = require('moment');

function registerHatsOff(connection, register, uuid, entityid) {

    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT INTO HatsOff SET ?';
        sqlparams = {
            hoid: uuidGenerator.v4(),
            uuid: uuid,
            entityid: entityid
        }
    }
    else{
        sqlquery = 'DELETE FROM HatsOff WHERE uuid = ? AND entityid = ?';
        sqlparams = [
            uuid,
            entityid
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * Returns a campaign's hatsoffs with pagination system
 * */
function loadHatsOffsLegacy(connection, entityid, limit, page) {

    console.log("limit and page is " + JSON.stringify(limit + " " + page, null, 3));

    var offset = page * limit;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM HatsOff ' +
            'WHERE entityid = ? ', [entityid], function(err, data){
            if(err){
                reject(err);
            }
            else{

                console.log("totalcount is " + JSON.stringify(data[0].totalcount, null, 3));
                var totalcount = data[0].totalcount;

                connection.query('SELECT User.firstname, User.lastname, User.uuid ' +
                    'FROM HatsOff ' +
                    'JOIN User ' +
                    'ON HatsOff.uuid = User.uuid ' +
                    'WHERE HatsOff.entityid = ? ' +
                    'ORDER BY HatsOff.regdate DESC ' +
                    'LIMIT ? ' +
                    'OFFSET ?', [entityid, limit, offset], function (err, rows) {

                    if(err){
                        reject(err);
                    }
                    else{

                        rows = rows.map(function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            return element;
                        });

                        resolve({
                            hatsoffs: rows,
                            requestmore: totalcount > (offset + limit)
                        });
                    }

                });
            }
        });
    });
}

function loadHatsOffs(connection, entityid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT HatsOff.regdate, User.firstname, User.lastname, User.uuid ' +
            'FROM HatsOff ' +
            'JOIN User ' +
            'ON HatsOff.uuid = User.uuid ' +
            'WHERE HatsOff.entityid = ? ' +
            'AND HatsOff.regdate < ? ' +
            'GROUP BY HatsOff.entityid, HatsOff.uuid ' +
            'ORDER BY HatsOff.regdate DESC ' +
            'LIMIT ? '/* +
             'OFFSET ?'*/, [entityid, lastindexkey, limit/*, offset*/], function (err, rows) {

            if(err){
                reject(err);
            }
            else{

                if(rows.length > 0){

                    rows = rows.map(function (element) {
                        element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                        return element;
                    });

                    resolve({
                        hatsoffs: rows,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        requestmore: rows.length >= limit
                    });
                }
                else{
                    resolve({
                        hatsoffs: rows,
                        lastindexkey: null,
                        requestmore: rows.length >= limit
                    });
                }
            }

        });
    });
}

module.exports = {
    registerHatsOff: registerHatsOff,
    loadHatsOffsLegacy: loadHatsOffsLegacy,
    loadHatsOffs: loadHatsOffs
};
