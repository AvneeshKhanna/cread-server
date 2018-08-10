/**
 * Created by avnee on 06-08-2017.
 */

var config = require('../../Config');

const sharerate = 10;
const checkrate_verified = 1;
const checkrate_not_verified = 0;
const required_verified_checks = 3;
const required_unverified_checks = 5;
const restrict_find_frequency = 25; //Measured in 'clicks per minute'

const royalty_percentage = 10;

const markup = 33; //in percentage TODO: Update markup
const minCashInAmt = config.isProduction() ? 10 : 2;    //TODO: Can change the amount based on team discussion

const explore_algo_base_score = 5;  //Base score for each entity

const max_intrst_selectn_div = config.isProduction() ? 4 : 4;   //Divisor to divide the number of items

const min_percentile_quality_user_downvote = 90;
const min_qpercentile_user_recommendation = 70;

const post_type = {
    SHORT: 'SHORT',
    CAPTURE: 'CAPTURE',
    MEME: 'MEME'
};

const mark_for_collab = {
    UNMARKED: 'UNMARKED',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED'
};

const share_time_interval = {
    same_share: {
        time_diff: config.isProduction() ? 24 : 2,
        time_diff_unit: config.isProduction() ? "hours" : "minutes"
    },
    diff_share: {
        time_diff: config.isProduction() ? 12 : 1,
        time_diff_unit: config.isProduction() ? "hours" : "minutes"
    }
};

const cache_time = {
    small: !(config.isProduction()) ? 20 : 60,          //1 minute
    medium: !(config.isProduction()) ? 20 : 120,        //2 minutes
    high: !(config.isProduction()) ? 20 : 300,          //5 minutes
    xhigh: !(config.isProduction()) ? 20 : 900,         //15 minutes
    xxhigh: !(config.isProduction()) ? 20 : 3600,       //1 hour
    xxxhigh: !(config.isProduction()) ? 20 : 21600,     //6 hours
    ultrahigh: !(config.isProduction()) ? 20 : 86400    //24 hours
};

const badgenames = {
    SIGN_UP: "Cread-ee",
    BIO: "Persona Grata",
    TOP_ARTIST: "Top Artist",
    FEATURED_ONCE: "Featured",
    FEATURED_3_CONSEC: "Star",
    COMMENT_GIVEN: "Critic",
    COMMENT_RECEIVED: "Alpha Artist",
    HATSOFF_GIVEN: "Admirer",
    HATSOFF_RECEIVED: "Praiseworthy",
    SHORT_WRITTEN_ON: "Word Player",
    CAPTURE_ADDED_ON: "Picasso",
    FOLLOWING: "Companion",
    FOLLOWERS: "Popular",
    FIRST_POST: "Inception",
    LONG_FORM: "Story Teller",
    CAPTURE_COLLAB_DONE: "Aesthete",
    SHORT_COLLAB_DONE: "Wordsworth"
};

const total_badges = Object.keys(badgenames).length - 1;

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
    post_type: post_type,
    cache_time: cache_time,
    explore_algo_base_score: explore_algo_base_score,
    min_percentile_quality_user_downvote: min_percentile_quality_user_downvote,
    min_qpercentile_user_recommendation: min_qpercentile_user_recommendation,
    max_intrst_selectn_div: max_intrst_selectn_div,
    mark_for_collab: mark_for_collab,
    total_badges: total_badges,
    badgenames: badgenames
};