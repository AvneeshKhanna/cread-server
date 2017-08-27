/**
 * Created by avnee on 26-08-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;

function checkForMultipleAccOnDevice() {
    return new Promise(function (resolve, reject) {
        connection.query("SELECT * FROM UserActivity WHERE regdate > DATE_SUB(NOW(), INTERVAL 1 DAY) AND device_imei <> NULL",
            null, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
    });
}

function checkForSuspicion(data) {

    var counts = {};

    //Grouping data according to device_imei
    var imei_numbers = data.map(function (element) {
        return element.device_imei;
    });

    var groupedData = {};

    data.forEach(function (element) {

        groupedData[element.device_imei] = [];

        for (var i = 0; i < data.length; i++) {
            var obj = data[i];

            if(element.device_imei === obj.device_imei){
                groupedData[element.device_imei].push(obj);
            }
        }
    });
}

function disableAccounts(uuids) {

}
