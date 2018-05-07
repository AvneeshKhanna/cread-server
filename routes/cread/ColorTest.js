/**
 * Created by avnee on 05-05-2018.
 */
'use-strict';

var color   = require('colour-extractor'),
    imgPath = 'F:\\Web Development\\NodeJS Projects\\cread-server\\images\\downloads\\18.jpg';

color.topColours(imgPath, true, function (colours) {
    console.log(color.rgb2hex(colours[0][1]));
});