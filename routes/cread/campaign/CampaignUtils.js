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

/**
 * Returns the details of the users who have shared a particular campaign. Implements pagination
 * */
function getCampaignShares(connection, cmid, sharetypeflag, limit, page) {

    console.log("limit and page is " + JSON.stringify(limit + " " + page, null, 3));

    var query = 'SELECT users.firstname, users.lastname, users.uuid, Share.shareid, COUNT(*) AS sharescount ' +
        'FROM Share ' +
        'JOIN users ' +
        'ON Share.uuid = users.uuid ' +
        'WHERE Share.cmid = ? ' +
        'AND Share.checkstatus = ? ' +
        'GROUP BY users.uuid ' +
        'ORDER BY Share.regdate DESC ';

    var offset = 0;

    if(page === -1){
        //For backward compatibility
        //Do nothing
    }
    else{
        //Modify the query
        offset = page * limit;
        query += 'LIMIT ? OFFSET ?';
    }

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(DISTINCT uuid) AS totalcount ' +
            'FROM Share ' +
            'WHERE cmid = ? ' +
            'AND checkstatus = ? ', [cmid, sharetypeflag], function(err, data){
            if(err){
                reject(err);
            }
            else{

                console.log("totalcount is " + JSON.stringify(data[0].totalcount, null, 3));
                var totalcount = data[0].totalcount;

                connection.query(query, [cmid, sharetypeflag, limit, offset], function (err, rows) {

                    if(err){
                        reject(err);
                    }
                    else{

                        rows = rows.map(function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            return element;
                        });

                        resolve({
                            rows: rows,
                            requestmore: totalcount > (offset + limit)
                        });
                    }

                });
            }
        });
    });
}

/**
 * Returns top 2 users' details who have shared the given campaign
 * */
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
                        element.profilepicurl = utils.createProfilePicUrl(element.uuid);
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