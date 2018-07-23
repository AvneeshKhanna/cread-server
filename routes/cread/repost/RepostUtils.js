/**
 * Created by avnee on 20-07-2018.
 */
'use-strict';

var uuidGen = require('uuid');
var async = require('async');

var updatesutils = require('../updates/UpdatesUtils');
var cacheutils = require('../utils/cache/CacheUtils');
var cachemanager = require('../utils/cache/CacheManager');

/**
 * Function to add a repost
 * */
function addRepost(connection, entityid, uuid) {
    return new Promise(function (resolve, reject) {
        var params = {
            repostid: uuidGen.v4(),
            entityid: entityid,
            uuid: uuid
        };

        connection.query('INSERT INTO Repost SET ?', [params], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * Function to delete a repost
 * */
function deleteRepost(connection, repostid, uuid) {
    return new Promise(function (resolve, reject) {
        //For precaution, both 'repostid' and 'uuid' are used here so that any potential error on the app where a user
        //sends another user's 'repostid' for a delete request, the comment shouldn't get deleted
        connection.query('DELETE FROM Repost WHERE repostid = ? AND uuid = ?', [repostid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function updateRepostDataForUpdates(connection, uuid, actor_uuid, entityid, category, other_collaborator) {
    return new Promise(function (resolve, reject) {
        if (true) {   //Case: Reposted TODO: Change condition during deletion from Updates table
            var updateparams = {
                uuid: uuid,
                actor_uuid: actor_uuid,
                entityid: entityid,
                other_collaborator: other_collaborator,
                category: category
            };
            updatesutils.addToUpdatesTable(connection, updateparams)
                .then(resolve, reject);
        }
        else {   //Case: Repost deleted TODO: Find a mechanism to locate a particular comment's row in Updates table
            /*var where_col_names = [
                "actor_uuid",
                "entityid",
                "other_collaborator",
                "category"
            ];
            var where_col_values = [
                actor_uuid,
                entityid,
                other_collaborator,
                "repost"
            ];
            return updatesutils.deleteFromUpdatesTable(connection, where_col_names, where_col_values);*/
            resolve();
        }
    });
}

module.exports = {
    addRepost: addRepost,
    deleteRepost: deleteRepost,
    updateRepostDataForUpdates: updateRepostDataForUpdates
};