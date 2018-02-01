/**
 * Created by avnee on 29-01-2018.
 */
'use-strict';

var updatesutils = require('../updates/UpdatesUtils');

function addProfileMentionToUpdates(connection, entityid, category, actor_uuid, uuid) {
    return new Promise(function (resolve, reject) { 
        var updateparams = {
            category: category,
            actor_uuid: actor_uuid,
            uuid: uuid,
            entityid: entityid
        };
        updatesutils.addToUpdatesTable(connection, updateparams)
            .then(resolve, reject);
    });
}

module.exports = {
    addProfileMentionToUpdates: addProfileMentionToUpdates
};