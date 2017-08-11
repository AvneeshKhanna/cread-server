/**
 * Created by avnee on 06-08-2017.
 */

const sharerate = 10;
const checkrate_verified = 2.5;
const checkrate_not_verified = 1;

const markup = 33; //in percentage TODO: Update markup
const minCashInAmt = 50;    //TODO: Can change the amount based on team discussion

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
    restrict_every_share: true  //TODO: toggle
};