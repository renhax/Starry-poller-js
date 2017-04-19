//Call search/status API with keywords
//Filter uid with follower more than 10000
//Update uid and category to database
var Parse = require('parse/node');
var request = require('request');
var http = require('http');
var async = require('async');

Parse.initialize("3ab2908a-d7d7-4637-87d1-e4690fd4f0ff");
Parse.serverURL = 'https://starryparse.azurewebsites.net/parse';
var now = new Date();

var keywordList = ['美国', '社会', '国际', '科技', '科普', '数码', '财经', '股市', '明星', '综艺', '电视剧', '电影', '音乐', '汽车', '体育', '运动健身', '健康', '瘦身', '养生', '军事', '历史', '美女模特', '美图', '情感', '搞笑', '辟谣', '正能量', '政务', '游戏', '旅游', '育儿', '校园', '美食', '房产', '家居', '星座', '三农', '设计', '艺术', '时尚', '美妆', '动漫', '宗教', '萌宠', '婚庆', '法律'];
var accessToken = '2.00pp4wDCYYNKtCf4759f0643aGcWTE';
var constructPageList = function() {
	var pageList = [];
	for (var i = 0; i < 1; i++) {
		pageList[i] = i + '';
	}
	return pageList;
};
var pageList = constructPageList();

var updateUserInfo = function(userCategoryList) {
	var WeiboUserDetail = Parse.Object.extend("WeiboUserDetail");
	for (var i = 0; i < userCategoryList.length; i++) {
		var weiboUserDetail = new WeiboUserDetail();
		var userData = userCategoryList[i].userData;
		weiboUserDetail.set('userId', userCategoryList[i].id);
		weiboUserDetail.set('category', userCategoryList[i].category);
		weiboUserDetail.set("userName", userData.name);
		weiboUserDetail.set("profile_picture", userData.avatar_hd);
		weiboUserDetail.set("bio", userData.description);
		weiboUserDetail.set("media_count", userData.statuses_count);
		weiboUserDetail.set("follows_count", userData.friends_count);
		weiboUserDetail.set("followed_by_count", userData.followers_count);
		weiboUserDetail.set("date", now);
		weiboUserDetail.save(null, {
			successs: function(weiboUserDetail) {
				console.warn('New object create with objectId: ' + weiboUserDetail.id);
			},
			error: function(weiboUserDetail, error) {
				console.warn('Failed to create new object, with error code: ' + error.message);
			}
		});
	};
};

var fetchKeywordUser = function() {
	//for (var i = 0; i < keywordList.length; i++) {
		var userCategoryList = [];
		async.each(keywordList, 
			function(keyword, callback) {
				request({
					uri: 'https://c.api.weibo.com/2/search/statuses/limited.json?access_token=' + accessToken + '&q=' + encodeURIComponent(keyword) + '&page=15&count=50',
					method: 'GET',
					timeout: 100000
				}, function(error, response, body) {
					var statuses = JSON.parse(body).statuses;
					for (var i = 0; i < statuses.length; i++) {
						var user = statuses[i].user;
						if (user.followers_count >10000) {
							var userID = statuses[i].user.idstr;
							var userCategory = {};
							userCategory['id'] = userID;
							userCategory['category'] = keyword;
							userCategory['userData'] = statuses[i].user;
							userCategoryList.push(userCategory);
						}
					}
				 	callback();
				});
			},
			function(err) {
				updateUserInfo(userCategoryList);
			}
		);
	//};
};

fetchKeywordUser();