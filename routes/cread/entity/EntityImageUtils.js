/**
 * Created by avnee on 02-05-2018.
 */
'use-strict';

var gm = require('gm');
var sizeOf = require('image-size');
var color_extract = require('colour-extractor');

var utils = require('../utils/Utils');
var userprofileutils = require('../user-manager/UserProfileUtils');

var base_buffer_file_path = './images/buffer';
var base_products_file_path = './images/products';
var base_uploads_file_path = './images/uploads';

const journal_canvas = {
    width: 750,
    height: 875
};

const journal_cover = {
    x_offset: 135,
    y_offset: 64,
    width: 512,
    height: 733
};

function getRadiusOfCurvature(img_width, curve_bent_fraction){
    return parseFloat(img_width * (1 + 4 * Math.pow(curve_bent_fraction, 2))/parseFloat(8 * curve_bent_fraction));
}

function getOffsetAtX(x, radius, img_width) {
    return Math.abs(Math.sqrt(parseFloat(Math.pow(radius, 2) - Math.pow(x, 2)))) - Math.abs(Math.sqrt(parseFloat(Math.pow(radius, 2) - (Math.pow(img_width, 2)/4))));
}

function createOverlayedImageCoffeeMug(typeid, uuid, type, img_path) {
    return new Promise(function (resolve, reject) {

        var image_dimen = sizeOf(img_path);

        var img_width = image_dimen.width,
            img_height = image_dimen.height;

        console.log("img width & height are " + img_width + " " + img_height);

        var curve_bent_center_fraction = 0.0675;    //Calculated from Coffee Mug photo and some iterations
        var img_split_step_size = Math.floor(img_width * 0.008);    //In pixels

        var img_path_arr = [];

        for(var i=0; i<(img_width/img_split_step_size); i++){
            img_path_arr.push(base_buffer_file_path + '/' + typeid + '-tile-' + i + '.png');
        }

        var radius = getRadiusOfCurvature(img_width, curve_bent_center_fraction);

        //Split the image into multiple strips
        gm(img_path)
            .command('convert')
            .out('-crop')
            .out(img_split_step_size + 'x' + img_height)
            .out('+adjoin') //Used to split images into multiple
            .write(base_buffer_file_path + '/' + typeid + '-tile-%d.png', function(error) {
                if (error) {
                    reject(error);
                }
                else{

                    //Offset each of the multiple strip/split images by a particular distance, 'h'. 'h' is calculated using the
                    //equation of a circle and the radius of curvature of a circle that passes through the three points forming the bend
                    //on the coffee mug circumference
                    var cntr = 0;
                    var x = -(img_width/2.0);
                    (function r() {
                        gm(img_path_arr[cntr])
                            .background('transparent')
                            // .resize(imageWidth, imageHeight)
                            // .gravity('Center')
                            .extent(img_split_step_size, img_height + (curve_bent_center_fraction * img_width), '-0-' + getOffsetAtX(x, radius, img_width))
                            .write(base_buffer_file_path + '/' + typeid + '-tile-' + cntr +'.png', function(error) {
                                if (error) {
                                    reject(error);
                                } else {
                                    console.log('offset x is ' + getOffsetAtX(x, radius, img_width));
                                    console.log('x is ' + x);
                                    cntr += 1;
                                    x += img_split_step_size;
                                    if(cntr < (img_width/parseFloat(img_split_step_size))){
                                        console.log("cntr is " + cntr);
                                        r();
                                    }
                                    else{

                                        //Append and combine the offset-ed, split images into one
                                        var gmstate = gm(img_path_arr[0]);
                                        for (var i = 1; i < img_path_arr.length; i++) {
                                            gmstate.append(img_path_arr[i], true);
                                        }
                                        gmstate
                                            .resize(400, 400)   //Calculated in accordance with coffe mug image
                                            .write(base_buffer_file_path + '/' + typeid + '-transformed.png', function (err) {
                                                if(err){
                                                    reject(err);
                                                }
                                                else{

                                                    var resized_img_dimen = sizeOf(base_buffer_file_path + '/' + typeid + '-transformed.png');

                                                    gm()
                                                        .command('composite')
                                                        .in(base_buffer_file_path + '/' + typeid + '-transformed.png')
                                                        .in('-geometry', '+' + (423 - resized_img_dimen.width/2.0) + '+' + (310.5 - resized_img_dimen.height/2.0))    // location of overlaying img is x,y
                                                        .in(base_products_file_path + '/coffee-mug.png')
                                                        .write(base_uploads_file_path + '/' + typeid + '-overlay-coffee-mug.png', function (err) {
                                                            if (err) {
                                                                reject(err);
                                                            }
                                                            else{
                                                                console.log('Image overlayed to coffee mug');

                                                                type = type.charAt(0) + type.substr(1).toLowerCase();   //In case, 'type' arg is supplied as SHORT or CAPTURE

                                                                var files_to_delete = [];
                                                                files_to_delete = files_to_delete.concat(img_path_arr);
                                                                files_to_delete = files_to_delete.concat([
                                                                    base_buffer_file_path + '/' + typeid + '-transformed.png',
                                                                    base_uploads_file_path + '/' + typeid + '-overlay-coffee-mug.png'
                                                                ]);

                                                                uploadOverlayedImage(uuid, type, base_uploads_file_path, typeid + '-overlay-coffee-mug.png', files_to_delete)
                                                                    .then(resolve, reject);
                                                            }
                                                        });

                                                }
                                            });
                                    }
                                }
                            });
                    })();

                }
            });

    });
}

function getDominantImgColorHex(imgpath, callback) {
    color_extract.topColours(imgpath, true, function (colours) {
        callback(color_extract.rgb2hex(colours[0][1]));
    });
}

function createOverlayedImageJournal(typeid, type, uuid, img_path) {
    return new Promise(function (resolve, reject) {

        var journal_aspect_ratio = parseFloat(journal_cover.width/journal_cover.height);

        getDominantImgColorHex(img_path, function (dcolor) {
            gm(img_path)
                .resize(journal_cover.width, journal_cover.width)   //The dimensions width  x width are given because gm adjusts height automatically according to aspect ratio
                .background(dcolor)
                .gravity('Center')
                .extent(journal_cover.width + 5, (journal_cover.width + 5)/journal_aspect_ratio)
                .write(base_buffer_file_path  + '/' + typeid + '-journal-extent.jpg', function (err) {
                    if(err){
                        reject(err);
                    }
                    else{
                        gm(base_buffer_file_path  + '/' + typeid + '-journal-extent.jpg')
                            .background('transparent')
                            //.gravity('Center')
                            .extent(journal_canvas.width, journal_canvas.height, '-' + journal_cover.x_offset + '-' + journal_cover.y_offset)
                            .write(base_buffer_file_path  + '/' + typeid + '-journal-base-layer.png', function (err) {
                                if(err){
                                    reject(err);
                                }
                                else{
                                    gm()
                                        .command('composite')
                                        .in(base_products_file_path + '/journal_layer_1.png')
                                        .in(base_buffer_file_path  + '/' + typeid + '-journal-base-layer.png')
                                        .write(base_uploads_file_path  + '/' + typeid + '-journal-overlayed.png', function (err) {
                                            if (err) {
                                                reject(err);
                                            }
                                            else{

                                                type = type.charAt(0) + type.substr(1).toLowerCase();   //In case, 'type' arg is supplied as SHORT or CAPTURE

                                                var files_to_delete = [];
                                                files_to_delete.push(
                                                    base_buffer_file_path  + '/' + typeid + '-journal-extent.jpg',
                                                    base_buffer_file_path  + '/' + typeid + '-journal-base-layer.png',
                                                    base_uploads_file_path  + '/' + typeid + '-journal-overlayed.png'
                                                );

                                                uploadOverlayedImage(uuid, type, base_uploads_file_path, typeid + '-journal-overlayed.png', files_to_delete)
                                                    .then(resolve, reject);
                                            }
                                        });
                                }
                            });
                    }
                });
        });
    })
}

function uploadOverlayedImage(uuid, type, upload_file_base_path, upload_filename, files_to_delete) {
    return new Promise(function (resolve, reject) {
        userprofileutils.uploadImageToS3(upload_file_base_path/*base_uploads_file_path*/ + '/' + upload_filename/*typeid + '-overlay-coffee-mug.png'*/,
            uuid,
            type,
            upload_filename/*typeid + '-overlay-coffee-mug.png'*/)
            .then(function () {

                resolve(upload_file_base_path/*base_uploads_file_path*/ + '/' + upload_filename/*typeid + '-overlay-coffee-mug.png'*/);

                /*var files_to_delete = [];
                files_to_delete = files_to_delete.concat(img_path_arr);
                files_to_delete = files_to_delete.concat([
                    base_buffer_file_path + '/' + typeid + '-transformed.png',
                    base_uploads_file_path + '/' + typeid + '-overlay-coffee-mug.png'
                ]);*/

                utils.deleteUnrequiredFiles(files_to_delete);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

module.exports = {
    createOverlayedImageCoffeeMug: createOverlayedImageCoffeeMug,
    createOverlayedImageJournal: createOverlayedImageJournal
};