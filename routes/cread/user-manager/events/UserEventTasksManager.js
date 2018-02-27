/**
 * Created by avnee on 27-02-2018.
 */
'use-strict';

var CronJob = require('cron').CronJob;
var usereventsutils = require('./UserEventsUtils');

var engagement_notification_job = new CronJob({
    //Runs every 2nd day, 8:00 pm
    cronTime: '00 00 18 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function() {

        usereventsutils.sendEngagementNotificationsForUsers()
            .then(function () {
                console.log("Engagement Notifications Process Completely");
            })
            .catch(function (err) {
                console.error(err);
                console.log("ERROR: Engagement Notifications Process Stopped");
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

module.exports = {
    engagement_notification_job: engagement_notification_job
};