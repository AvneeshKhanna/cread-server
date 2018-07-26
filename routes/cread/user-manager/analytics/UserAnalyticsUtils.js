/**
 * Created by avnee on 25-07-2018.
 */
'use-strict';

function updateUserTotalPosts(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE UserAnalytics UA, ' +
            '(SELECT COUNT(*) AS user_posts FROM Entity WHERE uuid = ? AND status = "ACTIVE") AS UP ' +
            'SET UA.total_uploads = UP.user_posts ' +
            'WHERE UA.uuid = ?', [uuid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = {
    updateUserTotalPosts: updateUserTotalPosts
};