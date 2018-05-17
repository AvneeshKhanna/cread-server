/**
 * Created by avnee on 09-04-2018.
 */
'use-strict';

var config = require('../../../Config');

const REDIS_KEYS = {

    USER_LATEST_POSTS: "usr:latest-posts",
    HTAG_OF_THE_DAY: "htag-of-the-day",

    //Kue Job Keys
    //addKeyPrefix is used because the communication with REDIS is managed by Kue instead of './routes/cread/utils/cache/CacheManager.js'
    KUE_JOB: addKeyPrefix("kue-job"),
    KUE_DEFAULT_CK_CHAT_MSG: addKeyPrefix("kue-default-ck-chat-msg"),    //For the welcome chat message from C. Kalakar to a new user
    KUE_CK_FIRST_CMNT_HTSOFF: addKeyPrefix("kue-ck-1st-post-comment-htsoff")
};

//TODO: Shift this function to REDIS_KEYS
function getEntityCommentCntCacheKey(entityid) {
    if (!entityid) {
        throw new Error("Entity ID cannot be undefined/null/empty-string");
    }

    return "ent:cmnt-cnt:" + entityid;
}

function getEntityCollabCntCacheKey(entityid) {
    if (!entityid) {
        throw new Error("Entity ID cannot be undefined/null/empty-string");
    }
    return "ent:collab-cnt:" + entityid;
}

function getEntityInfoCacheKey(entityid) {
    if (!entityid) {
        throw new Error("Entity ID cannot be undefined/null/empty-string");
    }
    return "ent:info:" + entityid;
}

function addKeyPrefix(key) {
    key = (config.isProduction() ? "p:" : "d:") + key;
    return key;
}

module.exports = {
    addKeyPrefix: addKeyPrefix,
    getEntityCommentCntCacheKey: getEntityCommentCntCacheKey,
    getEntityCollabCntCacheKey: getEntityCollabCntCacheKey,
    getEntityInfoCacheKey: getEntityInfoCacheKey,
    REDIS_KEYS: REDIS_KEYS
};