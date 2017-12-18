/**
 * Created by avnee on 18-12-2017.
 */
'use-strict';

function extractMatchingUniqueHashtags(caption, matchword) {
    var regex = new RegExp("\\#" + matchword + "(\\w+|\\s+)", "i");   //Match pattern containing specific hashtags
    var tagSet = new Set();
    var match;

    console.log('regex is ' + regex.toString() + ' with caption  ' + caption);

    while ((match = regex.exec(caption)) !== null) {
        caption = caption.replace(match[0], "");
        tagSet.add(match[0].replace("#", "").toLowerCase());
    }

    var tags = new Array();

    tagSet.forEach(function (tag) {
        tags.push(tag);
    });

    console.log(JSON.stringify(tags, null, 3));
    return tags;
}

function extractUniqueHashtags(caption) {
    var regex = /\#\w+/i;   //Match pattern containing hashtags
    var tagSet = new Set();
    var match;

    while ((match = regex.exec(caption)) !== null) {
        caption = caption.replace(match[0], "");
        tagSet.add(match[0].replace('#', '').toLowerCase());
    }

    var tags = new Array();

    tagSet.forEach(function (tag) {
        tags.push(tag);
    });

    console.log(JSON.stringify(tags, null, 3));
    return tags;
}

function addHashtagsToDb(connection, uniquehashtags, entityid) {

    var sqlparams = [];

    uniquehashtags.forEach(function (uniquetag) {

        sqlparams.push([
            uniquetag,
            entityid
        ]);

    });

    return new Promise(function (resolve, reject) {
        //'INSERT IGNORE' clause is used to ignore insertion of new rows into the table that violate
        //the UNIQUE index criteria of column(s) of the table
        connection.query('INSERT IGNORE INTO HashTagDistribution VALUES ?', sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function getHashtagCounts(connection, uniquetags) {

    uniquetags = uniquetags.map(function (t) {
        return t.replace('#', '');
    });

    return new Promise(function (resolve, reject) {
        connection.query('SELECT hashtag, COUNT(*) AS postcount ' +
            'FROM HashTagDistribution ' +
            'WHERE hashtag IN (?) ' +
            'GROUP BY hashtag ' +
            'ORDER BY postcount DESC', [uniquetags], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
    extractUniqueHashtags: extractUniqueHashtags,
    extractMatchingUniqueHashtags: extractMatchingUniqueHashtags,
    addHashtagsToDb: addHashtagsToDb,
    getHashtagCounts: getHashtagCounts
};