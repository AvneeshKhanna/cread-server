/**
 * Created by avnee on 01-05-2017.
 */
var express = require('express');
var router = express.Router();

var mysql = require('mysql');

var config = require('../Config');
var path = require('path');
var connection = config.createConnection;

router.get('/', function (request, response) {

    var refcode = request.query.refcode;
    var name = request.query.name;
    var job = request.query.job;
    var company = request.query.company;
    var piclink = request.query.piclink;
    var designation = request.query.designation;

    //TODO: Code for retrieving job-salary and user's profile pic

    var keys = {
        meta_tag_og_title : "I am referring for a position of Graphic Designer available in ML Books International Ltd.",
        meta_tag_og_image : "http://www.trendycovers.com/covers/Listen_to_your_heart_facebook_cover_1330517429.jpg",//photo article [piclink]
        name : name,
        job: job,
        company: company,
        designation: designation,
        refcode: refcode,
        profilepicurl: "https://organicthemes.com/demo/profile/files/2012/12/profile_img.png",
        salary: "Rs. 28,000 - Rs. 45,000 per month"
       /*metaTags.meta_tag_og_description = article.title; //title
         metaTags.meta_tag_og_type = article.title; //title as a name
         metaTags.meta_tag_og_url = article.description; //description*/
    };

    response.render(('refer.ejs'), keys);//render refer.ejs with meta tags; render function always looks in 'views' folder
    response.end();

    // response.send(data);
    // response.end();

});

router.post('/sms-link', function (request, response) {

    var contactnumber = request.body.contact;
    var referral_link = request.body.referral_link;

    //TODO: Code to send SMS using AWS sns api

    response.send({status: 'OK'});
    response.end();

});

module.exports = router;
