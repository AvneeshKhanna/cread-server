/**
 * Created by avnee on 07-06-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var _auth = require('../../auth-token-management/AuthTokenManager');

router.post('/load/', function (request, response) {

    var authkey = request.body.authkey;
    var uuid = request.body.uuid;

    console.log("authkey is " + JSON.stringify(authkey, null, 3));

    var resdata = {};

    _auth.checkToken(uuid, authkey, function (err, datasize) {

        if(err){
            console.error(err);
            throw err;
        }
        else if(datasize == 0) {

            resdata.tokenstatus = 'invalid';
            response.send(resdata);
            response.end();

        }
        else{
            //TODO: Add mission and fbidstatus
            connection.query('SELECT Campaign.cmid, Campaign.title, Campaign.description, Campaign.type, Campaign.contentbaseurl, ' +
                'Campaign.imagepath, Campaign.regdate, Share.sharerate, SUM(!ISNULL(Share.shareid)) AS sharescount, ' +
                'Client.name AS clientname, Client.bio AS clientbio ' +
                'FROM Campaign ' +
                'JOIN Client ' +
                'ON Campaign.clientid = Client.clientid ' +
                'LEFT JOIN Share ' +
                'ON Campaign.cmid = Share.cmid ' +
                'WHERE Campaign.cmpstatus = ? AND Campaign.budget > 0 ' +
                'GROUP BY Campaign.regdate', ['ACTIVE'],  function (err, rows) {

                if(err){
                    console.error(err);
                    throw err;
                }

                //Sorting according last created
                rows.sort(function (a, b) {
                    if(a.regdate < b.regdate){
                        return 1;
                    }
                    else {
                        return -1;
                    }
                });

                for (var i = 0; i < rows.length; i++) {
                    rows[i].mission = 'A random static mission which needs to be updated';
                    rows[i].fbidstatus = true;
                }

                console.log("rows after querying is " + JSON.stringify(rows, null, 3));

                response.send({
                    tokenstatus: 'valid',
                    data: rows
                });
                response.end();

            });
        }
    });

});

module.exports = router;