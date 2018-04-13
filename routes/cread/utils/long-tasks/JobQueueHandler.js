/**
 * Created by avnee on 04-04-2018.
 */
'use-strict';

//TODO: Setup AWS Elasticache for Redis to use 'kue' job framework

var config = require('../../../Config');
var jobqueue = config.getKueJobQueue();

var job = jobqueue.create('email', {
    title: 'welcome email for tj',
    to: 'tj@learnboost.com',
    template: 'welcome-email'
}).save(function (err) {
    if (!err) {
        console.log(job.id);
    }
});

