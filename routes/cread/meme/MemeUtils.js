/**
 * Created by avnee on 09-08-2018.
 */
'use-strict';

/**
 * Function to load URLs for meme photos
 * */
async function loadPresetMemePhotos(limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    let data = [
        'https://www.rd.com/wp-content/uploads/2018/05/shutterstock_725437768-760x506.jpg',
        'http://i.imgur.com/UzhNiIx.jpg',
        'https://i.kym-cdn.com/entries/icons/mobile/000/005/180/YaoMingMeme.jpg',
        'https://i.kym-cdn.com/entries/icons/original/000/016/546/hidethepainharold.jpg',
        'https://cdn.vox-cdn.com/thumbor/7wdvVMnJZvGfh4osoxfJ85awtCs=/0x0:500x375/1200x0/filters:focal(0x0:500x375)/cdn.vox-cdn.com/uploads/chorus_asset/file/10835833/n4scgse21iuz.jpg',
        'https://s1.r29static.com//bin/entry/7b0/100,0,1800,2400/x,80/1621852/image.jpg'
    ];

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