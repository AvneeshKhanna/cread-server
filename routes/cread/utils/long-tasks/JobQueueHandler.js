/**
 * Created by avnee on 04-04-2018.
 */
'use-strict';

const config = require('../../../Config');

const jobqueue = config.getKueJobQueue();
const kue = config.getKueClient();

function scheduleJob(jobKey, jobData, options) {
    return new Promise(function (resolve, reject) {

        let job = jobqueue.create(jobKey, jobData);

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