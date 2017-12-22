/**
 * Created by avnee on 06-08-2017.
 */

var envconfig = require('config');
var config_type = envconfig.get("type");

const sharerate = 10;
const checkrate_verified = 1;
const checkrate_not_verified = 0;
const required_verified_checks = 3;
const required_unverified_checks = 5;
const restrict_find_frequency = 25; //Measured in 'clicks per minute'

const royalty_percentage = 10;

const markup = 33; //in percentage TODO: Update markup
const minCashInAmt = (config_type === 'PRODUCTION') ? 10 : 2;    //TODO: Can change the amount based on team discussion

const share_time_interval = {
    same_share : {
        time_diff: config_type === 'PRODUCTION' ? 24 : 2,
        time_diff_unit: config_type === 'PRODUCTION' ? "hours" : "minutes"
    },
    diff_share: {
        time_diff: config_type === 'PRODUCTION' ? 12 : 1,
        time_diff_unit: config_type === 'PRODUCTION' ? "hours" : "minutes"
    }
};

const cache_time = {
    small: 60,
    medium: 120,
    high: 300,
    xhigh: 900,
    xxhigh: 3600
};

function getMarkup(markup) {
    if (markup > 100) {
        throw new Error('Markup value cannot be greater than 100');
    }
    else if (markup < 0) {
        throw new Error('Markup value cannot be negative');
    }
    else {
        return markup;
    }
}

module.exports = {
    sharerate: sharerate,
    checkrate_verified: checkrate_verified,
    checkrate_not_verified: checkrate_not_verified,
    markup: getMarkup(markup),
    min_cash_in_amt: minCashInAmt,
    restrict_every_share: true,  //TODO: toggle
    share_time_interval: share_time_interval,
    restrict_find_frequency: restrict_find_frequency,
    required_unverified_checks: required_unverified_checks,
    required_verified_checks: required_verified_checks,
    royalty_percentage: royalty_percentage,
    cache_time: cache_time
};