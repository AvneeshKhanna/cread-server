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
    height: 733,
    img_allowance: 3
};

const coffee_mug_base = {
    width: 673,
    height: 613
};

const coffee_mug_overlay = {
    overlay_x_crdnte: 400,
    overlay_y_crdnte: 400
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

        var img_aspect_ratio = parseFloat(img_width/img_height);

        console.log("img width & height are " + img_width + " " + img_height);

        const curve_bent_center_fraction = 0.0675;    //Calculated from Coffee Mug photo and some iterations
        var img_split_step_size; //In pixels
        if(img_width < 126){
            img_split_step_size = 1;    //If calculated acc to Math.floor(img_width * 0.008), img_split_step_size would be 0 causing Javascript heap out of memory errors
        }
        else{
            img_split_step_size = Math.floor(img_width * 0.008);
        }

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
                                    cntr += 1;
                                    x += img_split_step_size;
                                    if(cntr < (img_width/parseFloat(img_split_step_size))){
                                        r();
                                    }
                                    else{

                                        //Append and combine the offset-ed, split images into one
                                        var gmstate = gm(img_path_arr[0]);
                                        for (var i = 1; i < img_path_arr.length; i++) {
                                            gmstate.append(img_path_arr[i], true);
                                        }

                                        var overlay_resize_width, overlay_resize_height;

                                        if(img_aspect_ratio >= 1){  //Width >= Height
                                            overlay_resize_width = coffee_mug_overlay.overlay_x_crdnte;
                                            overlay_resize_height = parseFloat(overlay_resize_width/img_aspect_ratio);
                                        }
                                        else{   //Width < Height
                                            overlay_resize_height = coffee_mug_overlay.overlay_y_crdnte;
                                            overlay_resize_width = overlay_resize_height * img_aspect_ratio;
                                        }

                                        gmstate
                                            .resize(overlay_resize_width, overlay_resize_height)   //Calculated in accordance with coffe mug image
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

                                                                //Making the image square for UI
                                                                gm(base_uploads_file_path + '/' + typeid + '-overlay-coffee-mug.png')
                                                                    .background('transparent')
                                                                    .gravity('Center')
                                                                    .extent(coffee_mug_base.width, coffee_mug_base.width)
                                                                    .write(base_uploads_file_path + '/' + typeid + '-overlay-coffee-mug.png', function (err) {
                                                                        if(err){
                                                                            reject(err);
                                                                        }
                                                                        else {
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
                                                                    })
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
        try{
            var dcolor = color_extract.rgb2hex(colours[0][1]);
            callback(null, dcolor);
        }
        catch (err){
            callback(err, null);
        }
    });
}

function createOverlayedImageJournal(typeid, type, uuid, img_path) {
    return new Promise(function (resolve, reject) {

        var journal_aspect_ratio = parseFloat(journal_cover.width/journal_cover.height);
        var image_dimen = sizeOf(img_path);
        var entity_img_aspect_ratio = parseFloat(image_dimen.width/image_dimen.height);

        //Get dominant image color to put in background
        getDominantImgColorHex(img_path, function (err, dcolor) {
            if(err){
                reject(err);
            }
            else{
                gm(img_path)
                    .resize(journal_cover.width, journal_cover.width/entity_img_aspect_ratio)   //The dimensions 'Width X Width' are given because gm adjusts height automatically according to aspect ratio
                    .background(dcolor)
                    .gravity('Center')
                    .extent(journal_cover.width + journal_cover.img_allowance, (journal_cover.width + journal_cover.img_allowance)/journal_aspect_ratio)
                    .write(base_buffer_file_path  + '/' + typeid + '-journal-extent.jpg', function (err) {
                        if(err){
                            reject(err);
                        }
                        else{
                            //Extend the entity image to make it the shape of journal cover (vetically rectangular)
                            gm(base_buffer_file_path  + '/' + typeid + '-journal-extent.jpg')
                                .background('transparent')
                                //.gravity('Center')
                                .extent(journal_canvas.width, journal_canvas.height, '-' + journal_cover.x_offset + '-' + journal_cover.y_offset)
                                .write(base_buffer_file_path  + '/' + typeid + '-journal-base-layer.png', function (err) {
                                    if(err){
                                        reject(err);
                                    }
                                    else{
                                        //Overlay extended entity image over journal product photograph
                                        gm()
                                            .command('composite')
                                            .in(base_products_file_path + '/journal_layer_1.png')
                                            .in(base_buffer_file_path  + '/' + typeid + '-journal-base-layer.png')
                                            .write(base_uploads_file_path  + '/' + typeid + '-overlay-journal.png', function (err) {
                                                if (err) {
                                                    reject(err);
                                                }
                                                else{

                                                    //Making the image square for webstore UI
                                                    gm(base_uploads_file_path  + '/' + typeid + '-overlay-journal.png')
                                                        .background('#FFFFFF')
                                                        .gravity('Center')
                                                        .extent(journal_canvas.height, journal_canvas.height)
                                                        .write(base_uploads_file_path  + '/' + typeid + '-overlay-journal.png', function (err) {
                                                            if(err){
                                                                reject(err);
                                                            }
                                                            else {
                                                                type = type.charAt(0) + type.substr(1).toLowerCase();   //In case, 'type' arg is supplied as SHORT or CAPTURE

                                                                var files_to_delete = [];
                                                                files_to_delete.push(
                                                                    base_buffer_file_path  + '/' + typeid + '-journal-extent.jpg',
                                                                    base_buffer_file_path  + '/' + typeid + '-journal-base-layer.png',
                                                                    base_uploads_file_path  + '/' + typeid + '-overlay-journal.png'
                                                                );

                                                                uploadOverlayedImage(uuid, type, base_uploads_file_path, typeid + '-overlay-journal.png', files_to_delete)
                                                                    .then(resolve, reject);
                                                            }
                                                        })
                                                }
                                            });
                                    }
                                });
                        }
                    });
            }

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