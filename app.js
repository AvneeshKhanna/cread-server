'use-strict';

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var cors = require('cors');

var notifscheduler = require('./routes/notification-system/NotificationScheduler');
var monitorAccountActivity = require('./routes/cread/security/UserActivityMonitor').accountActivity;

var exploredatahandler = require('./routes/cread/feed/explore/ExploreFeedDataHandler');
//exploredatahandler.explore_feed_processing_recurrent.start();    //To start cron based processing for explore feed data

//To initiate the cron job for engagement notifications
//notifscheduler.engagement_notification_job.start();

//To initiate the cron job for featured artist notifications
notifscheduler.featured_artist_notification.start();

//To initiate the cron job for users-no-post notification
notifscheduler.users_no_post_notification.start();

//To initiate the cron job for first-posts notification
notifscheduler.first_posts_notification_job.start();

var scheduler = require('./routes/cread/utils/schedulers/SchedulerManager');
scheduler.update_latestposts_cache_job.start();
scheduler.delete_stale_hotds_job.start();
scheduler.reminder_hotd_job.start();
scheduler.generate_new_web_token_job.start();
scheduler.unlock_entities_job.start();
scheduler.add_product_images_job.start();
scheduler.help_queries_status_job.start();

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
var notification = require('./routes/notification-system/BulkNotification');
var pieCharts = require('./routes/dashboard/data-analytics/pieChart');
var countGraph = require('./routes/dashboard/data-analytics/countGraph');

var forgotPassValidContact = require('./routes/forgot-password/validateContact');
var updatePassword = require('./routes/forgot-password/updatePasswordCompat');
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
app.use(bodyParser.urlencoded({extended: false}));
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
app.use('/password-update', require('./routes/forgot-password/updatePassword'));
app.use('/update-contact', updateContact);
app.use('/internalrefer', internalReferral);
// app.use('/jobnotification', notification);
app.use('/bulk-notification', notification);
app.use('/notification-panel', require('./routes/cread/dsbrd/notification-manager/NotificationPanelDataLoader'));
// app.use('/dataAnalytics', pieCharts);
// app.use('/countGraph', countGraph);
app.use('/latest-updates', activityLogView);
app.use('/generate-pictorial', require('./routes/pictorial/generatePictorial'));

//CREAD
app.use('/social-reach', require('./routes/thetestament/social-reach-survey/SocialReachSurvey'));
app.use('/dev-utils', require('./routes/dev-utils/DevUtils'));
app.use('/one-time', require('./routes/cread/utils/OneTimeTasks'));

//CREAD

//-app-
app.use('/feed', require('./routes/cread/feed/main/MainFeedManager'));
app.use('/track-activity', require('./routes/cread/track/ActivityTracker'));
app.use('/share-campaign', require('./routes/cread/share/ShareCampaign'));
app.use('/check-campaign', require('./routes/cread/check/CheckCampaign'));
app.use('/user-profile', require('./routes/cread/user-manager/UserProfileManager'));
app.use('/user-access', require('./routes/cread/user-manager/UserAccessManager'));
app.use('/user-events', require('./routes/cread/user-manager/events/UserEventsManager'));
app.use('/redeem-from-wallet', require('./routes/cread/user-manager/payments/RedeemFromWallet'));
app.use('/givers-manager', require('./routes/cread/givers/GiversManager'));
app.use('/user-interests', require('./routes/cread/interests/UserInterestsManager'));
app.use('/entity-interests', require('./routes/cread/interests/EntityInterestsManager'));
app.use('/user-campaigns', require('./routes/cread/track/campaigns/UserCampaignManager'));
app.use('/explore-feed', require('./routes/cread/feed/explore/ExploreFeedManager'));
app.use('/inspiration-feed', require('./routes/cread/feed/InspirationFeedManager'));
app.use('/share-campaign-explore', require('./routes/cread/share/ShareCampaignExplore'));
app.use('/campaign-manage', require('./routes/cread/campaign/CampaignManager'));
app.use('/follow', require('./routes/cread/follow/FollowManager'));
app.use('/capture-upload', require('./routes/cread/capture/UploadCapture'));
app.use('/manage-short', require('./routes/cread/short/ShortManager'));
app.use('/short-upload', require('./routes/cread/short/UploadShort'));
app.use('/short-generate-for-print', require('./routes/cread/short/GenerateShortPrint'));
app.use('/capture-manage', require('./routes/cread/capture/CaptureManager'));
app.use('/entity-manage', require('./routes/cread/entity/EntityManager'));
app.use('/hatsoff', require('./routes/cread/hats-off/HatsOffManager'));
app.use('/comment', require('./routes/cread/comment/CommentManager'));
app.use('/products', require('./routes/cread/buy/ProductsManager'));
app.use('/order', require('./routes/cread/buy/OrderManager'));
app.use('/buying-track', require('./routes/cread/buy/track/BuyTrackManager'));
app.use('/sell', require('./routes/cread/sell/SellOrdersManager'));
app.use('/entity-share-link', require('./routes/cread/entity/share/EntityShareManager'));
app.use('/search', require('./routes/cread/search/SearchManager'));
app.use('/hashtag', require('./routes/cread/hashtag/HashTagManager'));
app.use('/hotd', require('./routes/cread/hashtag/HashTagOfTheDay'));
app.use('/updates', require('./routes/cread/updates/UpdatesManager'));
app.use('/chat-convo', require('./routes/cread/chat/ChatConversationManager'));
app.use('/chat-list', require('./routes/cread/chat/ChatListManager'));
app.use('/featured-artists', require('./routes/cread/featured-artists/FeaturedArtistsManager'));
app.use('/downvote', require('./routes/cread/downvote/DownvoteManager'));
app.use('/user-referral', require('./routes/cread/user-manager/refer/UserReferralManager'));
app.use('/recommend-users', require('./routes/cread/recommendations/UserRecommendManager'));
app.use('/recommend-posts', require('./routes/cread/recommendations/PostsRecommendManager'));
app.use('/popular-feed-buy', require('./routes/cread/feed/popular-feed-buy/PopularFeedBuyManager'));
app.use('/redis', require('./routes/dev-utils/RedisExample'));  //TODO: Remove
// app.use('/job-queue', require('./routes/cread/utils/long-tasks/JobQueueHandler'));  //TODO: Remove
app.use('/support', require('./routes/cread/support/HelpQuesManager'));
app.use('/mark-for-collab', require('./routes/cread/ops/mark-for-collab/MarkForCollabManager'));
app.use('/mark-as-star', require('./routes/cread/ops/mark-as-star/MarkAsStarManager'));
app.use('/repost', require('./routes/cread/repost/RepostManager'));
app.use('/badges', require('./routes/cread/badges/BadgeManager'));
app.use('/upload-meme', require('./routes/cread/meme/UploadMemeManager'));
app.use('/meme-manager', require('./routes/cread/meme/MemeManager'));

//-dashboard-
app.use('/campaign-details', require('./routes/cread/dsbrd/campaign-details/CampaignDetails'));
app.use('/campaign', require('./routes/cread/dsbrd/campaign-management/CampaignManager'));
app.use('/client-profile', require('./routes/cread/dsbrd/client-profile/ClientProfileManager'));
app.use('/wallet-screen', require('./routes/cread/dsbrd/wallet-management/WalletDataLoader'));
app.use('/wallet-management', require('./routes/cread/dsbrd/wallet-management/WalletTransactionManager'));
app.use('/budget-management', require('./routes/cread/dsbrd/campaign-management/budget-manager/BudgetManager'));
app.use('/latest-updates', require('./routes/cread/dsbrd/latest-updates/LatestUpdates'));
app.use('/password-link', require('./routes/cread/dsbrd/client-profile/password-update/PasswordLinkGenerator'));
app.use('/reset-password', require('./routes/cread/dsbrd/client-profile/password-update/PasswordUpdateManager'));

app.use('/cread-test', require('./routes/cread/test/Testing'));

app.get('/user-agent', function (request, response) {

    response.render(__dirname + '/views/facebook-test/ThankYou.ejs');
    response.end();

});

app.get('/agent', function (request, response) {

    console.log("headers are " + JSON.stringify(request.headers, null, 3));
    console.log("body is " + JSON.stringify(request.body, null, 3));

    response.send('Thanks');
    response.end();
});

app.use('/chatbot', chatbot);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.json({
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        message: err.message,
        error: {}
    });
});

//notifscheduler.top_post_notification.start(); TODO: Uncomment

// top_givers_notification.start();
// monitorAccountActivity.start(); //To monitor user accounts activity

module.exports = app;
