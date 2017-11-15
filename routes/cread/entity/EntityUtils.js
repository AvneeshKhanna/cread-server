/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

var utils = require('../utils/Utils');

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

function loadEntityData(connection, uuid, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, Short.shoid, ' +
            'Capture.capid AS captureid, COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount, ' +
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
            'WHERE Entity.entityid = ?', [entityid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                connection.query('SELECT (CASE WHEN(hoid IS NOT NULL) THEN true ELSE false END) AS hatsoffstatus  ' +
                    'FROM HatsOff ' +
                    'WHERE uuid = ? ' +
                    'AND entityid = ?', [uuid, entityid], function(err, hdata){
                    if(err){
                        reject(err);
                    }
                    else{
                        row[0].hatsoffstatus = hdata[0] ? !!hdata[0].hatsoffstatus : false;

                        row.map(function (element) {
                            element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                            if(element.type === 'CAPTURE'){
                                element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                            }
                            else{
                                element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                            }

                            element.creatorname = element.firstname + ' ' + element.lastname;
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

                            return element;
                        });

                        resolve({
                            entity: row[0]
                        });
                    }
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
    deactivateEntity: deactivateEntity
};