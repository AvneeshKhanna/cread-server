/*
This module is responsible for updating the specific part of profile segment which is requested. The requested data is updated in the 'User_Profile' table in DynamoDB.
*/

var express = require('express');
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');

var dynamo_marshal = require('dynamodb-marshaler');    //package to convert plain JS/JSON objects to DynamoDB JSON

AWS.config.region = 'ap-northeast-1';
var dynamodb = new AWS.DynamoDB();

/*var connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});*/

//These constants are same as that stored in app source code under 'profile'->'edit' package. 
const TYPE_PROFILE_SEGMENT_PHOTO = "profile-photo";
const TYPE_PROFILE_SEGMENT_BASIC = "basic-details";
const TYPE_PROFILE_SEGMENT_EDUCATION = "education";
const TYPE_PROFILE_SEGMENT_WORKEX = "work-experience";

/*
The general format of request.body should be of the type:
    {
        type: *type_value*,     //type_value should be one of the four types of const defined above
        data: *data_value*,
        userid: *uuid*
    }
*/
router.post('/', function(request, response){
    
    var segment_type = request.body.type;
    var segment_data = request.body.data;
    var userid = request.body.userid;
    
    checkValidId(userid, function(check_result){
                
        if(check_result != undefined && !isEmpty(check_result)){    //Condition to check if check_result is !(undefined) && !({})
            
            console.log('Requested userid is valid with result: ' + JSON.stringify(check_result));
            
            //Depending on the type of edit to perform, suitable functions are called using a switch-case direct
            switch(segment_type){
            
                case TYPE_PROFILE_SEGMENT_PHOTO:

                    updatePhotoPath(segment_data, userid, function(result){                

                        if(result){
                            response.send('Data updated: Profile Photo');
                            response.end();
                        }
                        else{
                            response.send('Data could not be updated');
                            response.end();
                        }

                    });

                    break;

                case TYPE_PROFILE_SEGMENT_BASIC:
                    
                    updateBasicDetails(segment_data, userid, function(result){
                        
                        if(result){
                            response.send('Data updated: Basic Details');
                            response.end();
                        }
                        else{
                            response.send('Data could not be updated');
                            response.end();
                        }
                        
                    });
                    break;

                case TYPE_PROFILE_SEGMENT_EDUCATION:
                    
                    updateEducationDetails(segment_data, userid, function(result){
                        
                        if(result){
                            response.send('Data updated: Education');
                            response.end();
                        }
                        else{
                            response.send('Data could not be updated');
                            response.end();
                        }
                        
                    });
                    
                    //call a function
                    break;

                case TYPE_PROFILE_SEGMENT_WORKEX:
                    
                    updateWorkExDetails(segment_data, userid, function(result){
                        
                        if(result){
                            response.send('Data updated: Work Experience');
                            response.end();
                        }
                        else{
                            response.send('Data could not be updated');
                            response.end();
                        }
                        
                    });
                    //call a function
                    break;

                default:
                    //Send appropriate message in response
                    response.send('Invalid request');
                    response.end();
            }            
        }
        else{
            response.send('User id does not exists');
            response.end();
        }
    });    
    
});

//This function checks if the requested userid exists or not, then forwards the request for updation
function checkValidId(userid, onCheck){
    
    var get_params = {};
    
    get_params.TableName = 'User_Profile';
    get_params.Key = {
        'UUID' : {
            'S' : userid
        }
    };
    
    dynamodb.getItem(get_params, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            console.log('DynamoDB Item Validation: ' + JSON.stringify(data));
            onCheck(data);
        }
        
    });
    
}

//This function updates the ProfilePicURL in 'User_Profile' table in DynamoDB
function updatePhotoPath(pic_url, userid, onUpdate){
    
    //To update item attributes in DynamoDB
    var update_params = {};
    
    update_params.TableName = 'User_Profile';
    update_params.Key = {
        'UUID' : {
            'S' : userid
        }
    };
    update_params.UpdateExpression = 'SET #attrName = :attrValue';
    update_params.ExpressionAttributeNames = {
        '#attrName' : 'ProfilePicURL'
    };
    update_params.ExpressionAttributeValues = {
        ':attrValue' : {
            'S' : pic_url
        }
    };
    update_params.ReturnValues = 'UPDATED_NEW';
    
    dynamodb.updateItem(update_params, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            console.log('DynamoDB Item Updated: ' + JSON.stringify(data));
            onUpdate(data);
        }
        
    });
    
}

function updateBasicDetails(basic_data, userid, onUpdate){
    
    //To update item attributes in DynamoDB
    var update_params = {};
    
    update_params.TableName = 'User_Profile';
    update_params.Key = {
        'UUID' : {
            'S' : userid
        }
    };
    update_params.UpdateExpression = 'SET #attrName1 = :attrValue1, #attrName2 = :attrValue2, #attrName3 = :attrValue3, #attrName4 = :attrValue4, #attrName5 = :attrValue5';
    update_params.ExpressionAttributeNames = {
        '#attrName1' : 'Name',
        '#attrName2' : 'Designation',
        '#attrName3' : 'ContactNumber',
        '#attrName4' : 'Email_Id',
        '#attrName5' : 'City'
    };
    update_params.ExpressionAttributeValues = {
        ':attrValue1' : {
            'S' : basic_data.name
        },
        ':attrValue2' : {
            'S' : basic_data.designation
        },
        ':attrValue3' : {
            'S' : basic_data.contact
        },
        ':attrValue4' : {
            'S' : basic_data.email
        },
        ':attrValue5' : {
            'S' : basic_data.city
        }
    };
    update_params.ReturnValues = 'UPDATED_NEW';
    
    dynamodb.updateItem(update_params, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            console.log('DynamoDB Item Updated: ' + JSON.stringify(data));
            onUpdate(data);
        }
        
    });
    
}

//To update Education attribute in 'User_Profile' table in DynamoDB. NOTE: The keys in the 'Education' attribute (since it is of the type List of //Maps) is not validated here. It has to be validated and ensured before sending the request.
function updateEducationDetails(edu_data, userid, onUpdate){
    
    //To update item attributes in DynamoDB
    var update_params = {};
    
    //Convert to DynamoDB JSON
    var marshalitem = dynamo_marshal.marshalItem;
    
    update_params.TableName = 'User_Profile';
    update_params.Key = {
        'UUID' : {
            'S' : userid
        }
    };
    update_params.UpdateExpression = 'SET #attrName1 = :attrValue1';
    update_params.ExpressionAttributeNames = {
        '#attrName1' : 'Education',
    };
    update_params.ExpressionAttributeValues = {
        ':attrValue1' : marshalitem(edu_data).ed_list
    };
    update_params.ReturnValues = 'UPDATED_NEW';
    
    dynamodb.updateItem(update_params, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            console.log('DynamoDB Item Updated: ' + JSON.stringify(data));
            onUpdate(data);
        }
        
    });
    
}

//To update Work_Experience attribute in 'User_Profile' table in DynamoDB. NOTE: The keys in the 'Work_Experience' attribute (since it is of the //type List of Maps) is not validated here. It has to be validated and ensured before sending the request.
function updateWorkExDetails(work_data, userid, onUpdate){
    
    //To update item attributes in DynamoDB
    var update_params = {};
    
    //Convert to DynamoDB JSON
    var marshalitem = dynamo_marshal.marshalItem;
    
    update_params.TableName = 'User_Profile';
    update_params.Key = {
        'UUID' : {
            'S' : userid
        }
    };
    update_params.UpdateExpression = 'SET #attrName1 = :attrValue1';
    update_params.ExpressionAttributeNames = {
        '#attrName1' : 'Work_Experience',
    };
    update_params.ExpressionAttributeValues = {
        ':attrValue1' : marshalitem(work_data).work_list
    };
    update_params.ReturnValues = 'UPDATED_NEW';
    
    dynamodb.updateItem(update_params, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            console.log('DynamoDB Item Updated: ' + JSON.stringify(data));
            onUpdate(data);
        }
        
    });
    
}

//Checks if an object is empty i.e object = {}. Returns 'true' if it is.
function isEmpty(object){
    
    if(Object.keys(object).length == 0){
        return true;
    }
    else{
        return false;
    }
    
}

module.exports = router;

