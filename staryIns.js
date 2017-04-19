var Parse = require('parse/node');
var request = require('request');
var http = require('http');
var async = require('async');

Parse.initialize("3ab2908a-d7d7-4637-87d1-e4690fd4f0ff");
Parse.serverURL = 'https://starryparse.azurewebsites.net/parse';

var OnboardedInstaUser = Parse.Object.extend("OnboardedInstaUser");
var query = new Parse.Query(OnboardedInstaUser);
var now = new Date();

var updateUserInfo = function(body, mediaData, userLocation, starryUserId) {
	var InstaUserDetail = Parse.Object.extend("InstaUserDetail");
	var instaUserDetail = new InstaUserDetail();

	instaUserDetail.set("userId", body.id);
	instaUserDetail.set("userName", body.username);
	instaUserDetail.set("profile_picture", body.profile_picture);
	instaUserDetail.set("bio", body.bio);
	instaUserDetail.set("website", body.website);
	instaUserDetail.set("media_count", body.counts.media);
	instaUserDetail.set("follows_count", body.counts.follows);
	instaUserDetail.set("followed_by_count", body.counts.followed_by);

	var followCount = body.counts.followed_by;
	var mediaList = [];
	var commentsCount = 0;
	var likesCount = 0;
	for (var i = 0; i < mediaData.length; i++) {
		commentsCount += mediaData[i].comments.count;
		likesCount += mediaData[i].likes.count;
		if (i < 3) {
			if (mediaData[i].images && mediaData[i].images.standard_resolution) {
				mediaList.push(mediaData[i].images.standard_resolution);
			}
		} 
	}
	var commentPerPost = commentsCount / mediaData.length;
	var likesPerPost = likesCount / mediaData.length;
	var likeRating = likesPerPost / followCount;
	var commentRating = commentPerPost / followCount;
	instaUserDetail.set("recent_media", mediaList);
	instaUserDetail.set("like_per_post", likesPerPost);
	instaUserDetail.set("comment_per_post", commentPerPost);
	instaUserDetail.set("like_rating", likeRating);
	instaUserDetail.set("comment_rating", commentRating);
	instaUserDetail.set("starryuserid", starryUserId);
	var location = [];
	for (var i = 0; i < Object.keys(userLocation).length; i++) {
		var name = Object.keys(userLocation)[i];
		var count = userLocation[name].count;
		var latitude = userLocation[name].latitude;
		var longitude = userLocation[name].longitude;
		var locationDetail = {};
		locationDetail.name = name;
		locationDetail.count = count;
		locationDetail.longitude = longitude;
		locationDetail.latitude = latitude;
		location.push(locationDetail);
	}
	instaUserDetail.set("follower_location_detail", location);
	instaUserDetail.set("date", now);
	// process String to Json
	//update or create new row
	instaUserDetail.save(null, {
  		success: function(instaUserDetail) {
    		// Execute any logic that should take place after the object is saved.
    		console.warn('New object created with objectId: ' + instaUserDetail.id + ' ' + body.username);
  		},
  		error: function(instaUserDetail, error) {
    		// Execute any logic that should take place if the save fails.
    		// error is a Parse.Error with an error code and message.
    		console.warn('Failed to create new object, with error code: ' + error.message);
  		}
	});

}

var retrieveUserInfo = function(userId, accessToken, starryUserId) {
	request({
		uri: "https://api.instagram.com/v1/users/" + userId + "/?access_token=" + accessToken,
		method: "GET",
		timeout: 10000
	}, function(error, response, body) {
		var parsed = JSON.parse(body);
		retrieveMediaInfo(parsed.data, userId, accessToken, starryUserId);
	});
};

var retrieveMediaInfo = function(userData, userId, accessToken, starryUserId) {
	request({
		uri: 'https://api.instagram.com/v1/users/' + userId + '/media/recent/?access_token=' + accessToken,
		method: "GET",
		timeout: 10000			
	}, function(error, response, body) {
		var mediaData = JSON.parse(body).data;
		retrieveFollowerInfo(userData, mediaData, userId, accessToken, starryUserId);
	});
}

var retrieveUserRecentMedia = function(userData, mediaData, userList, accessToken, starryUserId) {
	var userLocation = {};
	async.each(userList, 
		function(user, callback) {
			//send request to get media list
			var id = user.id;
			var locationMap = {};
			request({
				uri: 'https://api.instagram.com/v1/users/' + id + '/media/recent/?access_token=' + accessToken,
				method: "GET",
				timeout: 10000		
			}, function(error, response, body) {
				var data = JSON.parse(body).data;
				for (var i = 0; i < data.length; i++) {
					if (data[i].location){
						var latitude = data[i].location.latitude;
						var name = data[i].location.name;
						var longitude = data[i].location.longitude;
						if (!locationMap[name]) {
							var arr = [];
							arr.push(latitude);
							arr.push(longitude);
							locationMap[name] = arr;
						}
					}
				}
				for (var j = 0; j < Object.keys(locationMap).length; j++) {
					var name = Object.keys(locationMap)[j];
					if (!userLocation[name]) {
						var location = {};
						location['count'] = 1;
						location['latitude'] = locationMap[name][0];
						location['longitude'] = locationMap[name][1];
						userLocation[name] = location;
					} else {
						var oldCount = userLocation[name].count;
						userLocation[name].count = oldCount++;
					}
				}
				callback();
			});
		},
		function(err) {
			updateUserInfo(userData, mediaData, userLocation, starryUserId);
		}
	);
};

var retrieveFollowerInfo = function(userData, mediaData, userId, accessToken, starryUserId) {
	var userLocation = {};
	request({
		uri: "https://api.instagram.com/v1/users/self/follows/?access_token=" + accessToken,
		method: "GET",
		timeout: 10000
	}, function(error, response, body) {
		var parsed = JSON.parse(body);
		retrieveUserRecentMedia(userData, mediaData, parsed.data, accessToken, starryUserId);
	})
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