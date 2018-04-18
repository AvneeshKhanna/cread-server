/**
 * Created by avnee on 18-04-2018.
 */
'use-strict';

function promiseEx() {
    return new Promise(function (resolve, reject) {
        promiseEx2()
            .then(function () {
                resolve();

                console.log("Would this be called?");
            });
    });
}

function promiseEx2() {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}

promiseEx()
.then(function () {
    console.log("Voila");
});