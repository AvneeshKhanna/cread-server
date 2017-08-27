/**
 * Created by avnee on 26-08-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;

var async = require('async');
var CronJob = require('cron').CronJob;

try{
    var monitorAccountActivity = new CronJob({
        /*
         * Runs every-day
         * at 12:30:00 PM
         */
        cronTime: '30 * * * * *', //second | minute | hour | day-of-month | month | day-of-week
        onTick: checkForMultipleAccOnDevice,
        start: false,   //Whether to start just now
        timeZone: 'Asia/Kolkata'
    });
}
catch(ex){
    console.error("Invalid cron pattern")
}

function checkForMultipleAccOnDevice() {
    connection.query("SELECT * FROM UserActivity WHERE regdate > DATE_SUB(NOW(), INTERVAL 1 DAY) AND device_imei <> NULL",
        null, function (err, data) {
            if (err) {
                throw err;
            }
            else {
                groupData(data);
            }
        });
}

/**
 * Groups data into the form:
 *
 * {
 *  [
 *      *DEVICE_IMEI* : {
 *                      uuid: "abc",
 *                      activityid: "xyz",
 *                      action: "sign-out",
 *                      device_imei: "103o9i"
 *                      regdate: "271-08-21 20:18:00"
 *                      }
 *  ]
 *  .
 *  .
 *  .
 * }
 * */
function groupData(data) {

    //Grouping data according to device_imei
    var imei_numbers = data.map(function (element) {
        return element.device_imei;
    });

    var groupedData = {};

    imei_numbers.forEach(function (element) {
        groupedData[element] = [];
    });

    data.forEach(function (element) {
        groupedData[element.device_imei].push(element);
    });

    for (var prop in groupedData) {

        if (prop.length < 5) {
            groupedData.removeProperty(prop.valueOf());
        }
    }

    checkForSuspicion(groupedData);
}

/**
 * Suspicious data contains those device-imei numbers that have been registered as an action more than 5 times within 24 hours
 * */
function checkForSuspicion(suspiciousData) {
    var suspiciousIMEIs = Object.keys(suspiciousData);

    async.each(suspiciousIMEIs, function (imei, callback) {

        var uuids = suspiciousData[imei].map(function (elem) {
            return elem.uuid;
        });

        //Check if multiple UUIDs have been registered as action for a single IMEI
        if (checkForMultipleUUIDs(uuids)) {
            connection.query('UPDATE users SET accountstatus = ?, disabletime = NOW() WHERE UUID IN (?)', ["DISABLED", uuids], function (err, data) {
                if (err) {
                    callback(err);
                }
                else {
                    callback();
                }
            })
        }
        else {
            callback();
        }

    }, function (err) {
        if(err){
            console.error(err);
        }
    });
}

/*
 * Checks if the array contains multiple UUID values. Returns true if it does
 * */
function checkForMultipleUUIDs(array) {
    return !(array.length === new Set(arr).length);
}

module.exports = monitorAccountActivity;
