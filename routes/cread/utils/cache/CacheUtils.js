/**
 * Created by avnee on 09-04-2018.
 */
'use-strict';

var config = require('../../../Config');

const REDIS_KEYS = {
    USER_LATEST_POSTS: "usr:latest-posts",
    HTAG_OF_THE_DAY: "htag-of-the-day"
};

function addKeyPrefix(key) {
    key = (config.isProduction() ? "p:" : "d:") + key;
    return key;
}

module.exports = {
    addKeyPrefix: addKeyPrefix,
    REDIS_KEYS: REDIS_KEYS
};