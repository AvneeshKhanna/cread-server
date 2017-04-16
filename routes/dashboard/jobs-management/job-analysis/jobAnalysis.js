/**
 * Created by avnee on 31-03-2017.
 */

var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');

var config = require('../../../Config');
var _connection = config.createConnection;
var applicationSchema = require('../../../Schema');
var jobApplication = applicationSchema.jobApplication;

/*
* select aid,
 count(*) AS `Applications`,
 sum(case when `Application_status` = "Pending" then 1 else 0 end) AS `PendingCount`,
 sum(case when `Application_status` = "Reviewed" then 1 else 0 end) AS `ReviewedCount`,
 sum(case when `Application_status` = "Shortlisted" then 1 else 0 end) AS `ShortlistedCount`,
 sum(case when `Application_status` = "Approved" then 1 else 0 end) AS `ApprovedCount`,
 sum(case when `Application_status` = "Finalised" then 1 else 0 end) AS `FinalisedCount`,
 sum(case when `Application_status` = "Rejected" then 1 else 0 end) AS `RejectedCount`,
 sum(case when `Refcode` <> "none" then 1 else 0 end) AS `ReferralApplications`
 from `apply`
 where `jobid` = "92a21714-6edf-4002-8735-75937c7cc7bb";
* */

router.post('/', function(request, response){

    var juuid = request.body.juuid;

    var counts_query = 'SELECT COUNT(*) AS ApplicationsCount,' +
        ' SUM(CASE WHEN Application_status = ? THEN 1 ELSE 0 END) AS PendingCount,' +
        ' SUM(CASE WHEN Application_status = ? THEN 1 ELSE 0 END) AS ReviewedCount,' +
        ' SUM(CASE WHEN Application_status = ? THEN 1 ELSE 0 END) AS ShortlistedCount,' +
        ' SUM(CASE WHEN Application_status = ? THEN 1 ELSE 0 END) AS ApprovedCount,' +
        ' SUM(CASE WHEN Application_status = ? THEN 1 ELSE 0 END) AS FinalisedCount,' +
        ' SUM(CASE WHEN Application_status = ? THEN 1 ELSE 0 END) AS RejectedCount,' +
        ' SUM(CASE WHEN Refcode <> ? THEN 1 ELSE 0 END) AS ReferralApplications' +
        ' FROM apply WHERE jobid = ?';


    _connection.query(counts_query, ['Pending', 'Reviewed', 'Shortlisted', 'Approved', 'Finalised', 'Rejected', 'none', juuid],
        function (err, result){

        if(err){
            console.error(err);
            throw err;
        }
        else{

            console.log('Result from 1st query is ' + JSON.stringify(result, null, 3));

            var response_obj = {
                ApplicationStatus: {
                    Labels: [
                        'Pending',
                        'Reviewed',
                        'Shortlisted',
                        'Approved',
                        'Finalised',
                        'Rejected'
                    ],
                    Data: [
                        result[0].PendingCount,
                        result[0].ReviewedCount,
                        result[0].ShortlistedCount,
                        result[0].ApprovedCount,
                        result[0].FinalisedCount,
                        result[0].RejectedCount
                    ]
                },
                Applications:{
                    Referral: result[0].ReferralApplications,
                    Total: result[0].ApplicationsCount
                }
            };

            _connection.query('SELECT DISTINCT Earnings.incentiveId, Earnings.referralAmount, Earnings.paymentStatus' +
                ' FROM Earnings, apply WHERE Earnings.refCode = apply.Refcode ' +
                'AND apply.jobid = ?', [juuid], function (err, rows) {

                if(err){
                    console.error(err);
                    throw err;
                }
                else {

                    console.log('rows are ' + JSON.stringify(rows, null, 3));

                    response_obj.Rewards = calculateRewards(rows);

                    response.send(response_obj);
                    response.end();

                }

            });
        }

    });

});

/*
* Function to sum total pending rewards for the given job
* */
function calculateRewards(rewards){

    var res = {
        Pending: 0,
        Total: 0
    };

    rewards.forEach(function (item, index) {

        if(item.paymentStatus = 'Pending'){
            res.Pending += item.referralAmount;
        }

        res.Total += item.referralAmount;

    });

    return res;
}

module.exports = router;