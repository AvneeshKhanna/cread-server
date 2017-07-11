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
var test = require('./routes/test');
var signUpOTP = require('./routes/signUpOtpVerify');
var referralScreen = require('./routes/referralScreen');
var usersProfile = require('./routes/userProfile');
var jobApplication = require('./routes/jobApplication');
var checkauthToken = require('./routes/auth-token-management/AuthTokenManager');
var validateAuthToken = require('./routes/auth-token-management/AuthTokenManager');
var referraljobApplication = require('./routes/referraljobApplication');
var jobAnalysis = require('./routes/dashboard/jobs-management/job-analysis/jobAnalysis');
var jobAddition = require('./routes/dashboard/jobs-management/jobAddition');
var jobViewing = require('./routes/dashboard/jobs-management/jobViewing');
var jobDeactivation = require('./routes/dashboard/jobs-management/jobDeactivation');
var jodEdit = require('./routes/dashboard/jobs-management/jobEdit');
var usersView = require('./routes/dashboard/users-management/usersViewing');
var userProfileView = require('./routes/dashboard/users-management/userProfileView');
var userApplicationsView = require('./routes/dashboard/jobs-management/job-applications/userApplicationsViewing');
var userApplicationStatusUpdate = require('./routes/dashboard/jobs-management/job-applications/applicationStatusUpdate');
var referDetailsView = require('./routes/dashboard/referrer-detail/referrerDetailsView');
var activityLogView = require('./routes/dashboard/activity-log/activityLogView');
var refcode_gen = require('./routes/refer-external/RefcodeGen');
var refcode_gen_pictorial = require('./routes/refer-external/RefcodeGenPictorial');
var refcode_valid = require('./routes/refer-external/RefCodeValidator');
var apply_refext = require('./routes/refer-external/ApplyRefExternal');
var external_ref_link_data = require('./routes/refer-external/ExternalRefData');
var referrerdetailsforweb = require('./routes/refer-external/ReferrerDetailsForWeb');
var edit_profile = require('./routes/user-profile/EditProfileUpdate');
var paymentSystem = require('./routes/Payment-system/paymentDetails');
var contactSync = require('./routes/Contact-Synchronization/contactSync');
var internalReferral = require('./routes/refer-internal/internalReferral');
var notification = require('./routes/Notification-System/jobNotification');
var pieCharts = require('./routes/dashboard/data-analytics/pieChart');
var countGraph = require('./routes/dashboard/data-analytics/countGraph');

var forgotPassValidContact = require('./routes/forgot-password/validateContact');
var updatePassword = require('./routes/forgot-password/updatePassword');
var updateContact = require('./routes/update-contact/updateContact');

var chatbot = require('./routes/chat-bot/bot');

var app = express();

app.use(cors());
app.options('*', cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));  //{limit: '50mb'}: for handling large stream client requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);
app.use('/refer', Refer);
app.use('/check', Check);
app.use('/job-analysis', jobAnalysis);
app.use('/sign-up-otp', signUpOTP);
app.use('/referredUsers', referralScreen);
app.use('/userprofile', usersProfile);
app.use('/jobApplication', jobApplication);
app.use('/applicationReferrals', referraljobApplication);
app.use('/jobAddition', jobAddition);
app.use('/jobViewing', jobViewing);
app.use('/jobDeactivation', jobDeactivation);
app.use('/jobEdit', jodEdit);
app.use('/usersView', usersView);
app.use('/userProfileView', userProfileView);
app.use('/userApplicationsView', userApplicationsView);
app.use('/application-status-update', userApplicationStatusUpdate);
app.use('/refer-detail', referDetailsView);
app.use('/refcodegen', refcode_gen);  //for older compatibility
app.use('/refcodegen-pictorial', refcode_gen_pictorial);
app.use('/refcodevalid', refcode_valid);
app.use('/external-ref-link-data', external_ref_link_data);
app.use('/referrer-details-web', referrerdetailsforweb);
app.use('/refcodeapply', apply_refext);
app.use('/editprofile', edit_profile);
app.use('/paymentDetails', paymentSystem);
app.use('/jobupdationvalidation', checkauthToken);
app.use('/validate-auhtoken', validateAuthToken);
app.use('/contactsync', contactSync);
app.use('/password-validate-contact', forgotPassValidContact);
app.use('/update-password', updatePassword);
app.use('/update-contact', updateContact);
app.use('/internalrefer', internalReferral);
app.use('/jobnotification', notification);
app.use('/dataAnalytics', pieCharts);
app.use('/countGraph', countGraph);
app.use('/latest-updates', activityLogView);
app.use('/generate-pictorial', require('./routes/pictorial/generatePictorial'));

//CREAD

//-app-
app.use('/feed', require('./routes/creadit/feed/FeedDataManager'));
// app.use('/feed2', require('./routes/creadit/feed/FeedDataManager2'));
app.use('/track-campaigns', require('./routes/creadit/track/CampaignTracker'));
app.use('/share-campaign', require('./routes/creadit/share/ShareCampaign'));
app.use('/check-campaign', require('./routes/creadit/check/CheckCampaign'));
app.use('/user-profile', require('./routes/creadit/user-profile/UserProfileManager'));

//-dashboard-
app.use('/campaign-details', require('./routes/creadit/dsbrd/campaign-details/CampaignDetails'));
app.use('/campaign', require('./routes/creadit/dsbrd/campaign-management/CampaignManager'));
app.use('/client-profile', require('./routes/creadit/dsbrd/client-profile/ClientProfileManager'));
app.use('/wallet-screen', require('./routes/creadit/dsbrd/wallet-management/WalletDataLoader'));

// app.use('/creadit-test', require('./routes/creadit/test/DBLocking'));

app.use('/chatbot', chatbot);

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
