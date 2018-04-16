/**
 * Created by avnee on 04-04-2018.
 */
'use-strict';

//TODO: Setup AWS Elasticache for Redis to use 'kue' job framework

var config = require('../../../Config');

var jobqueue = config.getKueJobQueue();
var kue = config.getKueClient();
var cacheutils = require('../cache/CacheUtils');
var REDIS_KEYS = cacheutils.REDIS_KEYS;

function scheduleJob(jobKey, jobData, options) {
    return new Promise(function (resolve, reject) {

        var job = jobqueue.create(jobKey, jobData);

        if (options.hasOwnProperty('delay')) {
            job.delay(options.delay);
        }

        if (options.hasOwnProperty('removeOnComplete')) {
            job.removeOnComplete(options.removeOnComplete);
        }

        job.save(function (err) {
            if (err) {
                reject(err);
            }
            else {
                console.log("Job #" + job.id + " saved");
                resolve();
            }
        });

        cleanUp();

    });
}

function processJob(jobKey, callback) {
    jobqueue.process(jobKey, function (job, done) {
        callback(job.data);
        done();
    });
}

function cleanUp() {

    kue.Job.rangeByState('inactive', 0, 50, 'asc', function (err, jobs) {
        jobs.forEach(function (job) {
            job.remove(function () {
                console.log("Job removed with id #" + job.id);
            });
        });
    });

    kue.Job.rangeByState('failed', 0, 50, 'asc', function (err, jobs) {
        jobs.forEach(function (job) {
            job.remove(function () {
                console.log("Job removed with id #" + job.id);
            });
        });
    });

    kue.Job.rangeByState('complete', 0, 50, 'asc', function (err, jobs) {
        jobs.forEach(function (job) {
            job.remove(function () {
                console.log("Job removed with id #" + job.id);
            });
        });
    });

}

module.exports = {
    scheduleJob: scheduleJob,
    processJob: processJob
};