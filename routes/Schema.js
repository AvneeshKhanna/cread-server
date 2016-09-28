var schemaObject = require('node-schema-object');

var User = new schemaObject({
    UUID : String,
    username : String,
    password : String,
    firstname : String,
    lastname : String,
    email : String,
    phoneNo : String,
    address : String,
    age : String,
    Auth_key : String
});

var jobApply = new schemaObject({
    userid : String,
    jobid : String,
    Refcode : String,
    Status : String,
    Application_status : String
});

var profileSchema = new schemaObject({
    UUID : String,
    City : String,
    Designation : String,
    Email_Id : String,
    UserName : String,
    ContactNumber : String 
});

var jobApplication = new schemaObject({
    userid : String,
    jobid : String,
    Refcode :String,
    Status : String,
    Application_status : String
});

module.exports.jobApply = jobApply;
module.exports.User = User;
module.exports.jobApplication = jobApplication;

