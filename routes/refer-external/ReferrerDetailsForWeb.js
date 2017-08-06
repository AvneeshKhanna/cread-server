/**
 * Created by avnee on 01-05-2017.
 */
var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var AWS = require('aws-sdk');
var sns = new AWS.SNS();

var config = require('../Config');
var path = require('path');
var connection = config.createConnection;

var request_client = require('request');
var web_api_key = 'AIzaSyC8nnQXBJEsnfxgpIapFDtFDkr62xDLke4';

var projectpath = path.join(__dirname, '../../');

router.get('/', function (request, response) {

    var refcode = request.query.refcode;
    var name = request.query.name;
    var job = request.query.job;
    var company = request.query.company;
    var piclink = request.query.piclink;
    var designation = request.query.designation;
    var profilepicurl = request.query.profilepicurl;
    var pictoriallink = request.query.pictoriallink;
    var salary = request.query.salary;

    //If any of the below mentioned paramters are missing from the GET url, redirect the user to 404
    switch(undefined){
        case refcode: ;
        case name: ;
        case job: ;
        case company: ;
        /*case profilepicurl: ;
        case pictoriallink: ;*/
        case salary:
            response.render(projectpath + '/views/404.ejs');
            response.end();
            return;
    }

    var keys = {
        meta_tag_og_title : "I am referring for a position of " + job + " available at " + company,
        meta_tag_og_image : pictoriallink,
        name : name,
        job: job,
        company: company,
        designation: designation,
        refcode: refcode,
        profilepicurl: profilepicurl,
        salary: salary
       /*metaTags.meta_tag_og_description = article.title; //title
         metaTags.meta_tag_og_type = article.title; //title as a name
         metaTags.meta_tag_og_url = article.description; //description*/
    };

    response.render(('refer.ejs'), keys);//render refer.ejs with meta tags; render function always looks in 'views' folder
    response.end();

});

router.post('/sms-link', function (request, response) {

    var contactnumber = request.body.contact;
    var referral_link = request.body.referral_link;

    console.log('Deeplink long url ' + JSON.stringify(referral_link));

    var firebase_long_dy_url = getFirebaseDynamicLink(referral_link);

    console.log('Firebase long url ' + JSON.stringify(firebase_long_dy_url));

    var firebase_request_params = {
        json: {
            longDynamicLink: firebase_long_dy_url,
            suffix: {
                option: "UNGUESSABLE"
            }
        }
    };

    //Shorten the Firebase dynamic link
    request_client.post(
        'https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=' + web_api_key,
        firebase_request_params,
        function (error, res, body) {

            console.log('Response from Firebase link shortener is ' + JSON.stringify(res, null, 3));

            if (!error && res.statusCode == 200) {

                var params = {
                    attributes : {
                        DefaultSMSType : 'Transactional'
                    }
                };

                sns.setSMSAttributes(params, function(err, data){

                    if(err){
                        console.error(err);
                        throw err;
                    }
                    else{

                        var params = {
                            Message : 'You can download Market Recruit from here: \n\n' + body.shortLink,
                            PhoneNumber : '+91' + contactnumber
                        };

                        console.log('sns request sending');

                        sns.publish(params, function(err, data){

                            if(err){
                                throw err;
                            }
                            else{
                                response.send({status: 'OK'});
                                response.end();
                            }

                        });
                    }
                });

                /*console.log(JSON.stringify(body, null, 3));
                response.send(send_result);
                response.end();*/
            }
            else if(error){
                console.error(error);
                throw error;
            }
        }
    );

});

/*
 * Function to wrap the deep link into Firebase components and return
 * */
function getFirebaseDynamicLink(deeplink){

    return 'https://d8hxy.app.goo.gl/?link='
        +  encodeURIComponent(deeplink)
        + '&apn='
        + 'in.thetestament.marketrecruit'    //package name
        + '&amv='
        + '49'; //App minimum version code
}


module.exports = router;
