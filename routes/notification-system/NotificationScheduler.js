/**
 * Created by avnee on 27-07-2017.
 */

var notifyUsers = require('./NotificationUtils');
var CronJob = require('cron').CronJob;

var top_givers_notification = new CronJob({
    cronTime: '00 30 20 * * 1', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function() {
        /*
         * Runs every Monday
         * at 08:30:00 PM
         */

        var data = {
            Category: 'top_givers',
            Message: 'Check out the top givers of this week on Cread',
            AppModel: '2.0',
            Persist: false
        };

        notifyUsers.sendNotification(data, undefined, function (err) {
            if(err){
                console.error(err);
            }
            else {
                console.log('Successfully notified all users about the top givers of the week');
            }
        });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

module.exports = top_givers_notification;