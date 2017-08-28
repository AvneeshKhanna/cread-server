/**
 * Created by avnee on 26-08-2017.
 */

/*
 * This module is used to set 'accountstatus' as DISABLED for users which have either signed-in, signed-out or registered within last 24 hours
 * from a single device registering at least 2 UUIDs
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;

var async = require('async');
var CronJob = require('cron').CronJob;

try {
    var monitorAccountActivity = new CronJob({
        /*
         * Runs every-day every hour
         */
        cronTime: '0 0 * * * *', //second | minute | hour | day-of-month | month | day-of-week TODO: Revert back
        onTick: enableTemporarilyActiveAccounts,
        start: false,   //Whether to start just now
        timeZone: 'Asia/Kolkata'
    });
}
catch (ex) {
    console.error(new Error("Invalid cron pattern"));
}

/**
 * Enable accounts which have temporarily-enabled for more than 24 hours that were manually catered-to after suspicious activity
 * */
function enableTemporarilyActiveAccounts() {
    connection.query('UPDATE users ' +
        'SET accountstatus = ?, disabletime = ? ' +
        'WHERE accountstatus = ? ' +
        'AND reg_date > DATE_SUB(NOW(), INTERVAL 1 DAY)', ["ENABLED", null, "TEMP-ENABLED"], function (err, data) {
        if(err){
            console.error(err);
            throw err;
        }
        else{
            checkForMultipleAccOnDevice();
        }
    })
}

/**
 * Retrieve user-actions for the past 24-hours
 * */
function checkForMultipleAccOnDevice() {
    connection.query("SELECT * FROM UserActivity WHERE device_imei IS NOT NULL AND regdate > DATE_SUB(NOW(), INTERVAL 1 DAY)",
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

    //Removing those IMEIs which have actions < 5
    for (var prop in groupedData) {

        if (groupedData[prop].length < 5) {
            delete groupedData[prop];
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
            console.log("a few accounts deactivated");
            connection.query('UPDATE users ' +
                'SET accountstatus = ?, disabletime = NOW() ' +
                'WHERE UUID IN (?) ' +
                'AND accountstatus = ?', ["DISABLED", uuids, "ENABLED"], function (err, data) {
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
        if (err) {
            console.error(err);
        }
    });
}

/**
 * Checks if the array contains multiple but unique UUID values. Returns true if it does
 * */
function checkForMultipleUUIDs(array) {
    var uniqueids = new Set(array);
    return uniqueids.size > 1;
}

module.exports = {
    accountActivity: monitorAccountActivity,
    checkForMultipleAccOnDevice: checkForMultipleAccOnDevice
};
