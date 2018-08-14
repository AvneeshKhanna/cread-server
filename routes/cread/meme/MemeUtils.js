/**
 * Created by avnee on 09-08-2018.
 */
'use-strict';

const utils = require('../utils/Utils');

/**
 * Function to load URLs for meme photos
 * */
async function loadPresetMemePhotos(limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    let data = [];

    for (let i = 1; i < 27; i++) {
        data.push(utils.getMemePresetPhoto(i));
    }

    //Pagination logic
    let startpgntnindex = lastindexkey;
    let lastpgntnindex = data.length > (limit + lastindexkey) ? (limit + lastindexkey) : data.length;

    console.log("start index " + JSON.stringify(startpgntnindex, null, 3));
    console.log("last index " + JSON.stringify(lastpgntnindex, null, 3));

    let pagedata = data.slice(startpgntnindex, lastpgntnindex);

    return {
        requestmore: data.length >= (limit + lastindexkey),
        lastindexkey: lastpgntnindex,
        items: pagedata
    };
}

module.exports = {
    loadPresetMemePhotos: loadPresetMemePhotos
};