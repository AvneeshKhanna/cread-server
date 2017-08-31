/**
 * Created by avnee on 06-08-2017.
 */

var envconfig = require('config');
var config_type = envconfig.get("type");

const sharerate = 10;
const checkrate_verified = 2.5;
const checkrate_not_verified = 1;

const markup = 33; //in percentage TODO: Update markup
const minCashInAmt = 30;    //TODO: Can change the amount based on team discussion

const share_time_interval = {
    same_share : {
        time_diff: config_type == 'PRODUCTION' ? 24 : 2,
        time_diff_unit: config_type == 'PRODUCTION' ? "hours" : "minutes"
    },
    diff_share: {
        time_diff: config_type == 'PRODUCTION' ? 4 : 1,
        time_diff_unit: config_type == 'PRODUCTION' ? "hours" : "minutes"
    }
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
    share_time_interval: share_time_interval
};