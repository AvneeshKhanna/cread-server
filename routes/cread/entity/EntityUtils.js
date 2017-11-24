/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

var utils = require('../utils/Utils');

var moment = require('moment');

function retrieveShortDetails(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Short.shoid, Short.uuid AS shortuuid, Short.capid, Short.entityid, Short.txt, Short.textsize, Short.textcolor, Short.textgravity, Short.dx, Short.dy, Short.txt_width, Short.txt_height, Short.img_height, Short.img_width, Capture.uuid AS captureuuid ' +
            'FROM Short ' +
            'JOIN Capture ' +
            'ON Short.capid = Capture.capid ' +
            'WHERE Short.entityid = ?', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

function retrieveCaptureDetails() {

}

function loadCollabDetails(connection, entityid, entitytype, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    var query;

    if(entitytype === 'SHORT'){
        query = 'SELECT User.firstname, User.lastname, User.uuid, Capture.capid, Capture.entityid, Capture.regdate ' +
            'FROM Short ' +
            'JOIN Capture ' +
            'USING (shoid) ' +
            'JOIN User ' +
            'ON Capture.uuid = User.uuid ' +
            'WHERE Short.entityid = ? ' +
            'AND Capture.regdate < ? ' +
            'ORDER BY Capture.regdate DESC ' +
            'LIMIT ?'
    }
    else {
        query = 'SELECT User.firstname, User.lastname, User.uuid, Short.shoid, Short.entityid, Short.regdate ' +
            'FROM Capture ' +
            'JOIN Short ' +
            'USING (capid) ' +
            'JOIN User ' +
            'ON Short.uuid = User.uuid ' +
            'WHERE Capture.entityid = ? ' +
            'AND Short.regdate < ? ' +
            'ORDER BY Short.regdate DESC ' +
            'LIMIT ?'
    }

    return new Promise(function (resolve, reject) {
        connection.query(query, [entityid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                    element.name = element.firstname + ' ' + element.lastname;

                    if(entitytype === 'SHORT'){
                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.capid);
                    }
                    else{
                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                    }

                    /*if(element.capid){
                        delete element.capid;
                    }

                    if(element.shoid){
                        delete element.shoid;
                    }*/

                    if(element.firstname){
                        delete element.firstname;
                    }

                    if(element.lastname){
                        delete element.lastname;
                    }

                });

                if(rows.length > 0){
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        items: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        items: rows
                    });
                }
            }
        });
    });
}

function loadEntityData(connection, requesteruuid, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, Short.shoid, Capture.capid AS captureid, ' +
            'Capture.shoid AS cpshortid, Short.capid AS shcaptureid, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount, ' +
            'User.uuid, User.firstname, User.lastname ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'WHERE Entity.entityid = ?', [requesteruuid, entityid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                row.map(function (element) {
                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                    if(element.type === 'CAPTURE'){
                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                    }
                    else{
                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                    }

                    element.creatorname = element.firstname + ' ' + element.lastname;
                    element.hatsoffstatus = element.hbinarycount === 1;
                    element.merchantable = (element.merchantable !== 0);

                    /*if(element.capid) {
                        delete element.capid;
                    }*/

                    if(element.shoid) {
                        delete element.shoid;
                    }

                    if(element.firstname) {
                        delete element.firstname;
                    }

                    if(element.lastname) {
                        delete element.lastname;
                    }

                    if (element.hasOwnProperty('hbinarycount')) {
                        delete element.hbinarycount;
                    }

                    return element;
                });

                resolve({
                    entity: row[0]
                });
            }
        });
    });
}

function deactivateEntity(connection, entityid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'SET Entity.status = "DEACTIVE" ' +
            'WHERE Entity.entityid = ? ', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = {
    loadEntityData: loadEntityData,
    retrieveShortDetails: retrieveShortDetails,
    loadCollabDetails: loadCollabDetails,
    deactivateEntity: deactivateEntity
};