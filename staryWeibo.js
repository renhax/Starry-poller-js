var Parse = require('parse/node');
var request = require('request');
var http = require('http');
var async = require('async');

Parse.initialize("3ab2908a-d7d7-4637-87d1-e4690fd4f0ff");
Parse.serverURL = 'https://starryparse.azurewebsites.net/parse';

var OnboardedWeiboUser = Parse.Object.extend("OnboardedWeiboUser");
var query = new Parse.Query(OnboardedWeiboUser);
var now = new Date();

var updateUserInfo = function(userData, followerList, mediaData, starryUserId) {
	var WeiboUserDetail = Parse.Object.extend("WeiboUserDetail");
	var weiboUserDetail = new WeiboUserDetail();

	weiboUserDetail.set("userId", userData.id.toString());
	weiboUserDetail.set("userName", userData.name);
	weiboUserDetail.set("profile_picture", userData.avatar_hd);
	weiboUserDetail.set("bio", userData.description);
	weiboUserDetail.set("media_count", userData.statuses_count);
	weiboUserDetail.set("follows_count", userData.friends_count);
	weiboUserDetail.set("followed_by_count", userData.followers_count);

	var followerLocation = {};
	for (var i = 0; i < followerList.length; i++) {
		var location = followerList[i].location;
		if (!followerLocation[location]) {
			followerLocation[location] = 0;
		} else {
			followerLocation[location] = followerLocation[location] + 1;
		}
	}
	weiboUserDetail.set("follower_location_detail", Object.keys(followerLocation));

	var mediaList = [];
	var statusList = mediaData.statuses;

	var followCount = userData.followers_count;
	var commentsCount = 0;
	var repostsCount = 0;
	for (var i = 0; i < statusList.length; i++) {
		commentsCount += statusList[i].comments_count;
		repostsCount += statusList[i].reposts_count;
		mediaList.push(statusList[i].text);
	}
	var commentPerPost = commentsCount / statusList.length;
	var repostPerPost = repostsCount / statusList.length;
	var repostRating = repostPerPost / followCount;
	var commentRating = commentPerPost / followCount;
	weiboUserDetail.set("repost_per_post", repostPerPost);
	weiboUserDetail.set("comment_per_post", commentPerPost);
	weiboUserDetail.set("repost_rating", repostRating);
	weiboUserDetail.set("comment_rating", commentRating);
	weiboUserDetail.set("starryuserid", starryUserId);
	weiboUserDetail.set("recent_media", mediaList);
	weiboUserDetail.set("date", now);

	weiboUserDetail.save(null, {
		success: function(weiboUserDetail) {
		// Execute any logic that should take place after the object is saved.
		console.warn('New object created with objectId: ' + weiboUserDetail .id + ' ' + body.username);
		},
		error: function(weiboUserDetail, error) {
		// Execute any logic that should take place if the save fails.
		// error is a Parse.Error with an error code and message.
		console.warn('Failed to create new object, with error code: ' + error.message);
		}
	});
};

var retrieveUserFollowerList = function(userId, accessToken, starryUserId, userData, mediaData) {
	request({
		uri: "https://api.weibo.com/2/friendships/followers.json?access_token=" + accessToken + "&uid=" + userId,
		method: "GET",
		timeout: 10000
	}, function(error, response, body) {
		var parsed = JSON.parse(body);
		var followerList = parsed.users;
		updateUserInfo(userData, followerList, mediaData, starryUserId);
	});
};

var retrieveUserMediaInfo = function(userId, accessToken, starryUserId, userData) {
	request({
		uri: "https://api.weibo.com/2/statuses/user_timeline.json?access_token=" + accessToken + "&uid=" + userId,
		method: "GET",
		timeout: 10000
	}, function(error, response, body) {
		var parsed = JSON.parse(body);
		//updateUserInfo(userData, parsed, starryUserId);
		retrieveUserFollowerList(userId, accessToken, starryUserId, userData, parsed);
	});
};

var retrieveUserInfo = function(userId, accessToken, starryUserId) {
	request({
		uri: "https://api.weibo.com/2/users/show.json?access_token=" + accessToken + "&uid=" + userId,
		method: "GET",
		timeout: 10000
	}, function(error, response, body) {
		var parsed = JSON.parse(body);
		retrieveUserMediaInfo(userId, accessToken, starryUserId, parsed);
	});
};

query.find({
	success: function(results) {
		for (var i = 0; i < results.length; i++) {
			var userId = results[i].get('userid');
			var accessToken = results[i].get('accessToken');
			var starryUserId = results[i].get('starryuserid');
			retrieveUserInfo(userId, accessToken, starryUserId);
		}
	},
	error: function(error) {
		console.warn("Error: " + error.code + " " + error.message);
	}
})