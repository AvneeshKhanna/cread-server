var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var cors = require('cors');

var routes = require('./routes/index');
var users = require('./routes/users');
var Auth = require('./routes/Authentication');
var Refer = require('./routes/refer');
var Check = require('./routes/Check');
var referralScreen = require('./routes/referralScreen');
var usersProfile = require('./routes/userProfile');
var jobApplication = require('./routes/jobApplication');
//var checkauthToken = require('./routes/authtokenValidation');
var referraljobApplication = require('./routes/referraljobApplication');
var jobAddition = require('./routes/dashboard/jobAddition');
var jobViewing = require('./routes/dashboard/jobViewing');
var jodEdit = require('./routes/dashboard/jobEdit');
var usersView = require('./routes/dashboard/users-management/usersViewing');
var userProfileView = require('./routes/dashboard/users-management/userProfileView');
var refcode_gen = require('./routes/refer-external/RefcodeGen');
var refcode_valid = require('./routes/refer-external/RefCodeValidator');
var apply_refext = require('./routes/refer-external/ApplyRefExternal');
var edit_profile = require('./routes/user-profile/EditProfileUpdate');
var paymentSystem = require('./routes/Payment-system/paymentDetails');
//var contactSync = require('./routes/Contact-Synchronization/contactSync');

var app = express();

app.use(cors());
app.options('*', cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);
app.use('/refer' , Refer);
app.use('/check' , Check);
app.use('/referredUsers' , referralScreen);
app.use('/userprofile' , usersProfile);
app.use('/jobApplication' , jobApplication);
app.use('/applicationReferrals' , referraljobApplication);
app.use('/jobAddition' , jobAddition);
app.use('/jobViewing' , jobViewing);
app.use('/jobEdit', jodEdit);
app.use('/usersView', usersView);
app.use('/userProfileView', userProfileView);
app.use('/refcodegen', refcode_gen);
app.use('/refcodevalid', refcode_valid);
app.use('/refcodeapply', apply_refext);
app.use('/editprofile', edit_profile);
app.use('/paymentDetails' , paymentSystem);
//app.use('/jobupdationvalidation' , checkauthToken);
//app.use('/contactsync' , contactSync);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {}
  });
});

module.exports = app;
