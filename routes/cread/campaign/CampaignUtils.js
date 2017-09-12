/**
 * Created by avnee on 31-08-2017.
 */
'use-strict';

var config = require('../../Config');
var utils = require('../utils/Utils');

function addCampaign(params, connection) {
    return new Promise(function (resolve, reject) {

        if(!connection){
            connection = config.createConnection;
        }

        connection.query('INSERT INTO Campaign SET ?', params, function (err, result) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}

function updateCampaign(cmid, params, connection){
    return new Promise(function (resolve, reject) {

        if(!connection){
            connection = config.createConnection;
        }

        connection.query('UPDATE Campaign SET ? WHERE cmid = ?', [params, cmid], function (err, result) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function getCampaignShares(connection, cmid, sharetypeflag) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT users.firstname, users.lastname, users.UUID, Share.shareid, COUNT(*) AS sharescount ' +
            'FROM Share ' +
            'JOIN users ' +
            'ON Share.UUID = users.UUID ' +
            'WHERE Share.cmid = ? ' +
            'AND Share.checkstatus = ? ' +
            'GROUP BY users.UUID ', [cmid, sharetypeflag], function (err, rows) {

            if(err){
                reject(err);
            }
            else{
                resolve(rows);
            }

        });
    });
}

function getTopCampaignShares(connection, cmid, typeshareflag) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT users.firstname, users.uuid ' +
            'FROM Share ' +
            'JOIN users ' +
            'ON Share.uuid = users.uuid ' +
            'WHERE Share.cmid = ? ' +
            'AND Share.checkstatus = ? ' +
            'ORDER BY Share.regdate DESC ' +
            'LIMIT 2', [cmid, typeshareflag], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if(rows.length !== 0){
                    rows = rows.map(function (element) {
                        element.profilepicurl = utils.profilePicUrlCreator(element.uuid);
                        return element;
                    });
                }
                resolve(rows);
            }
        });
    });
}

module.exports = {
    addCampaign: addCampaign,
    updateCampaign: updateCampaign,
    getCampaignShares: getCampaignShares,
    getTopCampaignShares: getTopCampaignShares
};