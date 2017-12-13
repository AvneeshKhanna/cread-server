/**
 * Created by avnee on 23-11-2017.
 */
'use-strict';

/**
 * Function to retrieve the users' details whose content has been collaborated on
 * */
function getCollaborationData(connection, rows) {
    return new Promise(function (resolve, reject) {

        var shcaptureids = rows.filter(function (element) {
            return !!(element.shcaptureid);
        }).map(function (element) {
            return element.shcaptureid;
        });

        console.log("shcaptureids are " + JSON.stringify(shcaptureids, null, 3));

        var cpshortids = rows.filter(function (element) {
            return !!(element.cpshortid);
        }).map(function (element) {
            return element.cpshortid;
        });

        console.log("cpshortids are " + JSON.stringify(cpshortids, null, 3));

        var collabdataquery;
        var collabsqlparams;
        var retrievecollabdata = true;

        if (cpshortids.length !== 0 && shcaptureids.length !== 0) {
            collabdataquery = 'SELECT Entity.entityid, Short.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
                'UserS.lastname AS slastname, UserS.uuid AS suuid, UserC.firstname AS cfirstname, ' +
                'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                'FROM Entity ' +
                'LEFT JOIN Short ' +
                'ON Entity.entityid = Short.entityid ' +
                'LEFT JOIN Capture ' +
                'ON Entity.entityid = Capture.entityid ' +
                'LEFT JOIN User AS UserS ' +
                'ON Capture.uuid = UserS.uuid ' +
                'LEFT JOIN User AS UserC ' +
                'ON Short.uuid = UserC.uuid ' +
                'WHERE Capture.capid IN (?) ' +
                'OR Short.shoid IN (?)';
            collabsqlparams = [
                /*feedEntities,
                */shcaptureids,
                cpshortids
            ];
        }
        else if (cpshortids.length === 0 && shcaptureids.length !== 0) {
            collabdataquery = 'SELECT Entity.entityid, Capture.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
                'UserS.lastname AS slastname, UserS.uuid AS suuid ' + //', UserC.firstname AS cfirstname, ' +
                // 'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                'FROM Entity ' +
                // 'LEFT JOIN Short ' +
                // 'ON Entity.entityid = Short.entityid ' +
                'LEFT JOIN Capture ' +
                'ON Entity.entityid = Capture.entityid ' +
                'LEFT JOIN User AS UserS ' +
                'ON Capture.uuid = UserS.uuid ' +
                /*'LEFT JOIN User AS UserC ' +
                'ON Short.uuid = UserC.uuid ' +*/
                'WHERE Capture.capid IN (?) '/* +
                'OR Capture.shoid IN (?)'*/;

            collabsqlparams = [
                /*feedEntities,
                */shcaptureids/*,
                cpshortids*/
            ];
        }
        else if (cpshortids.length !== 0 && shcaptureids.length === 0) {
            collabdataquery = 'SELECT Entity.entityid, Short.shoid, Short.capid, UserC.firstname AS cfirstname, ' +
                'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                'FROM Entity ' +
                'LEFT JOIN Short ' +
                'ON Entity.entityid = Short.entityid ' +
                'LEFT JOIN User AS UserC ' +
                'ON Short.uuid = UserC.uuid ' +
                'WHERE Short.shoid IN (?)';
            collabsqlparams = [
                /*feedEntities,
                */cpshortids
            ];
        }
        else {
            retrievecollabdata = false;
        }

        if (retrievecollabdata) {
            //Retrieve collaboration data
            connection.query(collabdataquery, collabsqlparams, function (err, collab_rows) {
                if (err) {
                    reject(err);
                }
                else {

                    console.log("collab_rows are " + JSON.stringify(collab_rows, null, 3));
                    collab_rows.forEach(function (collab) {

                        var row_element;

                        if (collab.shoid) {   //Case where rows[i] is of type CAPTURE & collab_rows[i] is of type SHORT
                            row_element = rows[rows.map(function (e) {
                                if (!e.cpshortid) {
                                    e.cpshortid = null; //So that the length of the original array doesn't decrease
                                }
                                return e.cpshortid;
                            }).indexOf(collab.shoid)];

                            row_element.cpshort = {
                                name: collab.cfirstname  + ' ' + collab.clastname,
                                uuid: collab.cuuid,
                                entityid: collab.entityid
                            }
                        }
                        else {   //Case where rows[i] is of type SHORT & collab_rows[i] is of type CAPTURE
                            row_element = rows[rows.map(function (e) {
                                if (!e.shcaptureid) {
                                    e.shcaptureid = null;   //So that the length of the original array doesn't decrease
                                }
                                return e.shcaptureid;
                            }).indexOf(collab.capid)];

                            row_element.shcapture = {
                                name: collab.sfirstname + ' ' + collab.slastname,
                                uuid: collab.suuid,
                                entityid: collab.entityid
                            }
                        }
                    });

                    resolve(rows);
                }
            });
        }
        else {
            //Collaboration data not retrieved
            console.log('collaboration data not retrieved');
            resolve(rows);
        }
    });
}

function getCollaborationCounts(connection, rows, feedEntities){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.entityid, COUNT(DISTINCT SCap.capid) AS shortcollabcount, ' +
            'COUNT(DISTINCT CShort.shoid) AS capturecollabcount ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Entity.entityid = Short.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Entity.entityid = Capture.entityid ' +
            'LEFT JOIN Capture AS SCap ' +
            'ON Short.shoid = SCap.shoid ' +
            'LEFT JOIN Short AS CShort ' +
            'ON Capture.capid = CShort.capid ' +
            'WHERE Entity.entityid IN (?) ' +
            'GROUP BY Entity.entityid', [feedEntities], function (err, items) {
            if(err){
                reject(err);
            }
            else{

                if(items.length > 0){
                    items.forEach(function (item) {

                        var row_element = rows[rows.map(function (el) {
                            return el.entityid;
                        }).indexOf(item.entityid)];

                        if(row_element.type === 'SHORT'){
                            row_element.collabcount = item.shortcollabcount;
                        }
                        else{
                            row_element.collabcount = item.capturecollabcount;
                        }

                    });

                    resolve(rows);
                }
                else{
                    resolve(rows);
                }
            }
        });
    });
}

module.exports = {
    getCollaborationData: getCollaborationData,
    getCollaborationCounts: getCollaborationCounts
};