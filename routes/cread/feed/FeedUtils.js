/**
 * Created by avnee on 23-11-2017.
 */
'use-strict';

function getCollaborationData(connection, rows, feedEntities) {
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
                'WHERE Entity.entityid IN (?) ' +
                'AND Capture.capid IN (?) ' +
                'OR Short.shoid IN (?)';
            collabsqlparams = [
                feedEntities,
                shcaptureids,
                cpshortids
            ];
        }
        else if (cpshortids.length === 0 && shcaptureids.length !== 0) {
            collabdataquery = 'SELECT Entity.entityid, Short.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
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
                'WHERE Entity.entityid IN (?) ' +
                'AND Capture.capid IN (?) '/* +
                'OR Capture.shoid IN (?)'*/;

            collabsqlparams = [
                feedEntities,
                shcaptureids/*,
                cpshortids*/
            ];
        }
        else if (cpshortids.length !== 0 && shcaptureids.length === 0) {
            collabdataquery = 'SELECT Entity.entityid, Short.shoid, Capture.capid, UserC.firstname AS cfirstname, ' +
                'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                'FROM Entity ' +
                'LEFT JOIN Short ' +
                'ON Entity.entityid = Short.entityid ' +
                'LEFT JOIN User AS UserC ' +
                'ON Short.uuid = UserC.uuid ' +
                'WHERE Entity.entityid IN (?) ' +
                'AND Short.shoid IN (?)';
            collabsqlparams = [
                feedEntities,
                cpshortids
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
                                firstname: collab.cfirstname,
                                lastname: collab.clastname,
                                uuid: collab.cuuid
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
                                firstname: collab.sfirstname,
                                lastname: collab.slastname,
                                uuid: collab.suuid
                            }
                        }
                    });

                    resolve(rows);
                }
            });
        }
        else {
            resolve(rows);
        }
    });
}

module.exports = {
    getCollaborationData: getCollaborationData
};