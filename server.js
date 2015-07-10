var http         = require('http');
var express      = require('express');
var app          = express();
var async        = require('async');
var bodyParser   = require('body-parser');
var Building     = require('./models/building.js');
var Floor        = require('./models/floor.js');
var Unit         = require('./models/unit.js');
var Group        = require('./models/group.js');
var User         = require('./models/user.js');
var mongoose     = require('mongoose');
var jwt          = require('jsonwebtoken');
var apn          = require('apn');
var crypto       = require('crypto');
var config       = require('./config.js');
var underscore   = require('underscore');
var morgan       = require('morgan');
var uuid         = require('node-uuid');

mongoose.connect('mongodb://localhost:8888/');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan('dev'));
// Encrypt using openSSL, aes-256-cbc
var encryptPassword = function (password, callback) {
	var cipher = crypto.createCipher('aes-256-cbc', config.crypto);
	cipher.update(password, input_encoding='utf8', output_encoding='binary');
	var encrypted = cipher.final(output_encoding='binary');
	callback(encrypted);
};
// Decrypt using openSSL, aes-256-cbc
var decryptPassword = function (password, callback) {
	var decipher = crypto.createDecipher('aes-256-cbc', config.crypto);
	decipher.update(password, input_encoding='binary', output_encoding='utf8');
	var decrypted = decipher.final(output_encoding='utf8');
	callback(decrypted);
};
app.get('/welcome', function (req, res) {
	res.send('Welcome!');
});
/*
	Sign Up
	=======
	Sign up an account for a new user
	@params
		email: email address in form of <string>@<string>.<string>
		password: password should contain at least one of 0-9, a-z, A-Z, and has length of 6-16, inclusive.
	@rtn
		success: false, message: 'Email not provided.'
		success: false, message: 'Password not provided.'
		success: false, message: 'Invalid password.'
		success: false, message: 'Invalid email.'
		success: true, token: "YNVadwya9cu39m0c3c..."
		*/
// Validation
var validateEmail = function (email, callback) {
	var re = /\S+@\S+\.\S+/;
	if (re.test(email)) {
		return callback(true);
	} else {
		return callback(false);
	};
};
// Validation
var validatePassword = function (password, callback) {
	var re = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9!@#$%^&*]{6,16}$/;
	if (re.test(password)) {
		return callback(true);
	} else {
		return callback(false);
	};
};
// Validation middleware
app.post('/signup', function (req, res, next) {
	if (!req.body.email) {
		res.json({ success: false, message: 'Email not provided.' })
	}
	if (!req.body.password) {
		res.json({ success: false, message: 'Password not provided.' })
	}
	next();
});
// Request Handler
app.post('/signup', function (req, res) {
	async.parallel([
		function (callback) {
			validateEmail(req.body.email, function (rtn) {
				callback(null, rtn);
			});
		},
		function (callback) {
			validatePassword(req.body.password, function (rtn) {
				callback(null, rtn);
			});
		}
		], function (err, results) {
			if (results[0] == true) {
				if (results[1] == true) {
					encryptPassword(req.body.password, function (rtn) {
						var token = uuid.v1();
						var tmp = {
							email: req.body.email,
							password: rtn,
							token: token
						};
						var schema = underscore.extend(tmp, config.userDefault);
						var user = new User(schema);
						user.save(function (err, user) {
							if (err) throw err;
							console.log('User signed up successfully.');
							res.json({ 
								success: true,
								token: token,
								id: user._id
							});
						});	
					}); 			
				} else {
					res.json({ success: false, message: 'Invalid password.' });
				};
			} else {
				res.json({ success: false, message: 'Invalid email.' });
			};
		});
});
/*
	End
	*/
/* 
	Sign In
	=======
	Signin using an existing account
	@params
		email: email as registered
		password: password as registered
	@rtn
	    success: false, message: 'Sign in failed. Email not provided.'
		success: false, message: 'Sign in failed. User not found.'
		success: false, message: 'Sign in failed. Wrong password.'
		success: false, message: 'Sign in failed. Password not provided.'
		success: true, token: "YNVadwya9cu39m0c3c..."
		*/
// Validation
var validateSignInParams = function (req, callback) {
	if (!req.body.email) {
		return callback(1);
	} else if (!req.body.password) {
		return callback(2);
	} else {
		return callback(0);
	}
};
// Validation middleware
app.post('/signin', function (req, res, next) {
	validateSignInParams(req, function (rtn) {
		switch(rtn) {
			case 1:
			return res.json({ success: false, message: 'Sign in failed. Email not provided.' });
			case 2:
			return res.json({ success: false, message: 'Sign in failed. Password not provided.' });
			case 0: 
			return next();
		};
	});
});
// Request handler
app.post('/signin', function (req, res) {
	User.findOne({
		email: req.body.email
	}, function(err, user) {
		if (err) throw err;
		if (!user) {
			return res.json({ success: false, message: 'Sign in failed. User not found.' });
		} else if (user) {
			decryptPassword(user.password, function (rtn) {
				if (rtn != req.body.password) {
					return res.json({ success: false, message: 'Sign in failed. Wrong password.' });
				} else {
					var token = uuid.v1();
					user.token = token;
					user.save(function (err, user) {
						if (err) throw err;
						console.log('User signed in successfully.');
						res.json({
							success: true,
							token: token,
							id: user._id
						});
					});
				};
			});
		};
	});
});
/*
	End
	*/

/*
	Secure Upload
	=============
	Securely upload the floorplans to server
	@params
		name: name of the unit
		coordinates: coordinates of four vertices of the unit
		floors: array of floor object, in form of:
			name: name of floor, like B1, 3, 5, Ground floor
			map: the url of map image
	@rtn
	*/
// Get form
app.get('/secureupload', function(req, res){
	var html = '<form action="/secureupload" method="post">' +

	'Security code:' +
	'<input type="password" name="security" placeholder="Password" />' +
	'<br><br>' +

	'Unit name:' +
	'<input type="text" name="unitName" placeholder="Evans" />' +
	'<br><br>' +

	'Coordinates:' +
	'<input type="text" name="coordinates" placeholder="1.234,2.345,3.456,4.567" />' +
	'<br><br>' +

	'NamesArray:' +
	'<input type="text" name="names" placeholder="1,2,3,4,5..." />' +
	'<br><br>' +

	'MapsArray:' +
	'<input type="text" name="maps" placeholder="url,url,url..." />' +
	'<br><br>' +

	'<button type="submit">Submit</button>' +
	'</form>';        
	res.send(html);
});
// Validation
validateSecureUploadParams = function (req, callback) {
	if (!req.body.security) {
		return callback(1);
	};
	if (!req.body.unitName) {
		return callback(2);
	};
	if (!req.body.coordinates) {
		return callback(3);
	};
	if (!req.body.names) {
		return callback(4);
	};
	if (!req.body.maps) {
		return callback(5);
	};
	return callback(0);
} ;
// Validation middleware
app.post('/secureupload', function (req, res, next) {
	validateSecureUploadParams(req, function (rtn) {
		switch(rtn) {
			case 0:
				return next();
			case 1:
				var html = 'Security code should not be empty';
				return res.send(html);
			case 2:
				var html = 'Unit name should not be empty';
				return res.send(html);
			case 3:
				var html = 'Coordinates should not be empty';
				return res.send(html);
			case 4:
				var html = 'Names should not be empty';
				return res.send(html);
			case 5:
				var html = 'Maps should not be empty';
				return res.send(html);
		};
	});
});
// Request handler
app.post('/secureupload', function (req, res){
	if (req.body.security != config.secureUpload) { 
		var html = 'Upload unauthorized!';
		return res.send(html);
	};
	arrayOfCoordinates = [];
	arrayOfCoordinatesInString = req.body.coordinates.split(',');
	for (var i=0; i < 4; i++) {
		arrayOfCoordinates[i] = arrayOfCoordinatesInString[i];
	}
  	var schema = {
  		name: req.body.unitName,
  		coordinates: arrayOfCoordinates,
  		names: req.body.names.split(','),
  		maps: req.body.maps.split(',')
  	};
  	var unit = new Unit(schema);
  	unit.save(function (err, unit) {
  		var html = unit.name + ' is uploaded successfully.';
  		return res.send(html);
  	});
  
});
/*
	End
	*/

/*
	Token authentication middleware
	@params
		token: token as given when sign in or sign up
	@rtn
		success: false, message: 'Failed to authenticate token.'
		success: false, message: 'No token provided.'
		*/
app.use(function (req, res, next) {
	var token = req.body.token || req.query.token || req.headers['token'];
	if (token) {
		User.findOne({ token: token }, function (err, user) {
			if (err) throw err;
			if (!user) {
				return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });   
			} else {
				req.user_id = user._id;
				next();
			};
		});
	} else {
		return res.status(403).send({ 
			success: false, 
			message: 'No token provided.' 
		});
	};
});
/*
	End
	*/
/*
	Upload Location
	===============
	Upload the user's location in coordinates.
	@params
		token: user token
		location: pair of floats representing longitude and latitude, split by ','. e.g. 12.345, 67.890
	@rtn
		success: false, message: 'Location is not an array of two elements.'
		success: false, message: 'Location is not an array of floats.'
		success: false, message: 'Location parameter not found.'
		success: false, message: 'Update location failed. User not found.'
		success: false, message: 'Invalid location.'
		success: true, message: 'Location updated.'
		*/
// Validation
var validateUploadLocationParams = function (req, callback) {
	location = req.body.location;
	var coordinates = location.split(',');
	if (!location) {
		return callback(3);
	} else if (coordinates.length != 2) {
		return callback(1);
	} else {
		if (isNaN(parseFloat(coordinates[0])) || isNaN(parseFloat(coordinates[1]))) {
			return callback(2);
		} else {
			return callback(0);
		};
	};
};
// Validation middleware
app.post('/uploadlocation', function (req, res, next) {
	validateUploadLocationParams(req, function (rtn) {
		switch(rtn) {
			case 0:
			return next();
			case 1:
			return res.json({ success: false, message: 'Location is not an array of two elements.' });
			case 2:
			return res.json({ success: false, message: 'Location is not an array of floats.' });
			case 3:
			return res.json({ success: false, message: 'Location parameter not found.' });
		};
	});
});
// Request handler
app.post('/uploadlocation', function (req, res) {
	User.findOne({
		_id: req.user_id
	}, function (err, user) {
		if (err) throw err;
		if (!user) {
			return res.json({ success: false, message: 'Upload location failed. User not found.' });
		} else if (user) {
			var tmp = req.body.location.split(',');
			user.location = [parseFloat(tmp[0]), parseFloat(tmp[1])];
			user.save(function (err) {
				if (err) throw err;
				return res.json({ success: true, message: 'Location uploaded.' });
			});
		};
	});
});
/*
	End
	*/
/*
	Initialize Facebook Friends
	===========================
	Initialize facebook friends after register with facebook account.
	@params
		token: user token
		ids: array of user_ids from facebook. e.g. [12345, 67890, 13579]
	@rtn
		success: false, message: 'Friends parameter not found.'
		success: false, message: 'Friends parameter is not an array of numbers'
		success: false, message: 'Initialization failed. User not found.' 
		*/
// Validation
var validateInitializeFacebookFriendsParams = function (req, callback) {
	friends = req.body.ids;
	if (!friends) {
		return callback(1);
	};
	if (typeof(friends) != 'object') {
		return callback(2);
	};
	return callback(0);
};
// Validation middleware
app.post('/initializefacebookfriends', function (req, res, next) {
	validateInitializeFacebookFriendsParams(req, function (rtn) {
		switch(rtn) {
			case 0:
			return next();
			case 1:
			return res.json({ success: false, message: 'Friends parameter not found.' });
			case 2:
			return res.json({ success: false, message: 'Friends parameter is not an array of numbers' });
		};
	});
});
// Request handler
app.post('/initializefacebookfriends', function (req, res) {
	ids = req.body.ids;
	User.findOne({
		_id: req.user_id
	}, function (err, user) {
		if (err) throw err;
		if (!user) {
			return res.json({ success: false, message: 'Initialization failed. User not found.' });
		} else if (user) {
			User.find({ _userId: { $in: ids } }, function (err, users) {
				if (err) throw err;
				for (var friend in users) {
					user.friends.push(friend._id);
				};
				res.json({ success: true })
			});
		};
	});
});
/*
	End
	*/
/*
	Create Group And Sent Event
	===========================
	Create a group and send invitations to friends
	@params
		token: user token
		pin: pair of floats representing longitude and latitude, split by ','. e.g. 12.345, 67.890
		ids: array of objectId of users you want to invite
	@rtn

	*/
// Validation
var validateCreateGroupParams = function (req, callback) {
	pin = req.body.pin;
	invitees = req.body.ids;
	var coordinates = pin.split(',');
	if (!pin) {
		return callback(3);
	} else if (coordinates.length != 2) {
		return callback(1);
	} else {
		if (isNaN(parseFloat(coordinates[0])) || isNaN(parseFloat(coordinates[1]))) {
			return callback(2);
		} else {
			if (!invitees) {
				return callback (4);
			} else {
				return callback(0);
			};
		};
	};
};
// Validation middleware
app.post('/creategroup', function (req, res, next) {
	validateCreateGroupParams(req, function (rtn) {
		switch(rtn) {
			case 0:
			return next();
			case 1:
			return res.json({ success: false, message: 'Pin is not an array of length 2.' });
			case 2:
			return res.json({ success: false, message: 'Pin is not an array of floats.' });
			case 3:
			return res.json({ success: false, message: 'Pin not provided.' });
			case 4:
			return res.json({ success: false, message: 'Ids not provided.' });
		}
	});
});
app.post('/creategroup', function (req, res) {
	User.findOne({
		_id: req.user_id
	}, function (err, user) {
		if (err) throw err;
		if (!user) {
			return res.json({ success: false, message: 'Create group failed. User not found.' });
		} else if (user) {
			var coordinates = req.body.pin.split(',');
			var schema = {
				name: req.body.name,
				pin: [parseFloat(coordinates[0]), parseFloat(coordinates[1])],
				users: req.body.ids,
				active: true
			};
			var group = new Group(schema);
			group.save(function (err, group) {
				if (err) throw err;
				res.json({ success: true, message: 'Group created.' });
				// Do invitation
				ids = req.body.ids;
				tmp = ids.substring(1, ids.length - 1);
				array = tmp.split(',');
				User.find({
					'_id': { $in: array }
				}, function (err, users) {
					for (var i = 0; i < users.length; i++) {
						users[i].groupInviteIds.push(group._id);
						users[i].save(function (err) {
							if (err) throw err;
						});
					};
				});
				return;
			});
		};
	});
});
/*
	End
	*/

/*
	Accept Group Invite
	===================
	Accept a group invite sent by other people.
	@params
		token: user token
		invite: objectId for the group you want to join
	@rtn

	*/
// Validation

// Validation middleware

// Request handler
/*
	End
	*/

/*
	Show Unit Map
	=============
	Show the map according to unit name
	@params
		token: user token
		name: name of unit
	@rtn
		success: true, unit: JSON.Stringify(unit)
		success: false, message: 'Name not provided.'
		*/
// Validation
var validateShowUnitMapParams = function (req, callback) {
	name = req.body.name;
	if (!name) {
		return callback(1);
	};
	return callback(0);
};
// Validation middleware
app.post('/showunitmap', function (req, res, next) {
	validateShowUnitMapParams(req, function (rtn) {
		switch(rtn) {
			case 1:
			return res.json({ success: false, message: 'Name not provided.' });
			case 0:
			return next();
		}
	});
});
// Request handler
app.post('/showunitmap', function (req, res) {
	Unit.findOne({ name: req.body.name }, function (err,unit) {
		if (err) throw err;
		return res.json({ success: true, unit: JSON.Stringify(unit) });
	});	
});
/*
	End
	*/


/* 
	Server setup
	*/
	var server = app.listen(8080, function () {
		var host = server.address().address;
		var port = server.address().port;
		console.log('Architekt listening at http://%s:%s', host, port);
	});
/*
	End
*/