/**
 * Created by avnee on 09-04-2018.
 */
'use-strict';

var config = require('../../../Config');

const REDIS_KEYS = {

    USER_LATEST_POSTS: "usr:latest-posts",
    HTAG_OF_THE_DAY: "htag-of-the-day",

    //Kue Job Keys
    KUE_JOB: addKeyPrefix("kue-job"),
    KUE_DEFAULT_CK_CHAT_MSG: addKeyPrefix("kue-default-ck-chat-msg")    //For the welcome chat message from C. Kalakar to a new user
};

function getEntityCommentCntCacheKey(entityid) {
    if (!entityid) {
        throw new Error("Entity ID cannot be undefined/null/empty-string");
    }

    return "ent:cmnt-cnt:" + entityid;
}

function addKeyPrefix(key) {
    key = (config.isProduction() ? "p:" : "d:") + key;
    return key;
}

module.exports = {
    addKeyPrefix: addKeyPrefix,
    getEntityCommentCntCacheKey: getEntityCommentCntCacheKey,
    REDIS_KEYS: REDIS_KEYS
};