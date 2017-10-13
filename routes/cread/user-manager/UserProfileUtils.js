/**
 * Created by avnee on 27-09-2017.
 */
'use-strict';

function loadTimeline(connection, uuid, limit, page) {

    var offset = limit * page;

    return new Promise(function (resolve, reject) {

        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'WHERE Capture.uuid = ? ' +
            'OR Short.uuid = ? ', [], function(err, data){
            if(err){
                reject(err);
            }
            else{
                var totalcount = data[0].totalcount;

                connection.query('SELECT * ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'WHERE Capture.uuid = ? ' +
                    'OR Short.uuid = ? ' +
                    'ORDER BY Entity.regdate DESC', [uuid, uuid], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {

                        resolve({
                            requestmore: totalcount > (offset + limit),
                            items: rows
                        });
                    }
                });

            }
        });


    });
}

function loadProfileInformation(connection, uuid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.firstname, User.lastname, User.profilepicurl, Follow.followee, Follow.follower ' +
            'FROM User ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = User.uuid OR Follow.follower = User.uuid) ' +
            'WHERE User.uuid = ?', [uuid], function (err, rows) {
            if (err) {
                reject(err)
            }
            else {
                var followercount = rows.filter(function (elem) {
                    return (elem.followee === uuid);
                }).length;

                var followingcount = rows.filter(function (elem) {
                    return (elem.follower === uuid);
                }).length;

                var userdata = rows[0];

                userdata.followercount = followercount;
                userdata.followingcount = followingcount;

                resolve(userdata);
            }
        });
    });
}

module.exports = {
    loadTimeline: loadTimeline,
    loadProfileInformation: loadProfileInformation
};