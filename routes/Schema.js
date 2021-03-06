var schemaObject = require('node-schema-object');

var User = new schemaObject({
    UUID : String,
    password : String,
    firstname : String,
    lastname : String,
    email : String,
    phoneNo : String,
    Auth_key : String
});

var job = new schemaObject({
    JUUID : String,
    title : String,
    payscale : String,
    companyname : String,
    details : String,
    RefAmount : Number,
    Domain : String,
    payscale_type : String
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
module.exports.Job = job;

