var http         = require('http');
var express      = require('express');
var app          = express();
var async        = require('async');
var bodyParser   = require('body-parser');
var Institute    = require('./models/institute.js')
var Building     = require('./models/building.js');
var Floor        = require('./models/floor.js');
var Group        = require('./models/group.js');
var User         = require('./models/user.js');
var Chat         = require('./models/chat.js');
var mongoose     = require('mongoose');
var apn          = require('apn');
var crypto       = require('crypto');
var config       = require('./config.js');
var underscore   = require('underscore');
var morgan       = require('morgan');
var uuid         = require('node-uuid');
// var sig          = require('amazon-s3-url-signer');

// var AWS          = require('aws-sdk');
// var S3FS         = require('s3fs');
// var multiparty   = require('connect-multiparty');
// var multipartyMiddleware = multiparty();
// var awsjson      = require('./aws.json');
// var s3fs         = new S3FS('architek-hq', awsjson);

mongoose.connect(config.database);
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
	return res.send('Welcome!');
});


/*
	+------------------+
	| Get Chats Nearby |
	+------------------+
	> Get a list of all the chats nearby
	
	Created at V0.1.0
	@params
		coordinate: the numeral coordinate of a location (lat, lng)
	@return 
	@errors

*/
app.get('/getchatsnearby', function (req, res) {
	var coordinate = req.query.coordinate || req.headers['coordinate'];
	if (!coordinate) {
		return res.json({ success: false, message: 'Coordinate not provided.' })
	};
	var arrayOfCoordinates = [];
	var arrayOfCoordinatesInString = coordinate.split(',');
	for (var i=0; i < 2; i++) {
		if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
			return res.json({ success: false, message: 'Coordinate not float.' })
		}
		arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[1 - i]);
	};
	console.log(arrayOfCoordinates);
	if (arrayOfCoordinates[0] > 180 || arrayOfCoordinates[0] < -180 || arrayOfCoordinates[1] > 90 || arrayOfCoordinates[1] < -90) {
		return res.json({ success: false, message: 'Coordinates out of bound.' });
	};
	Chat.find({
		location: { '$nearSphere': arrayOfCoordinates,
		'$maxDistance': 1/(6378)
		}
	}, function (err, chats) {
		if (err) throw err;
		return res.json({ success: true, chats: chats});
	});
});
/*
	End
*/

/*
	+-----------------------+
	| Get Chats By Building |
	+-----------------------+
	> Get a list of all the chats according to building name
	
	Created at V0.1.0
	@params
		buildinglocation: the name of the building
	@return 
	@errors

*/
app.get('/getchatsbylocation', function (req, res) {
	var coordinate = req.query.location || req.headers['location'];
	if (!coordinate) {
		return res.json({ success: false, message: 'Location not provided.' })
	};
	var arrayOfCoordinates = [];
	var arrayOfCoordinatesInString = coordinate.split(',');
	for (var i=0; i < 2; i++) {
		if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
			return res.json({ success: false, message: 'Coordinate not float.' })
		}
		arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[1 - i]);
	};
	console.log(arrayOfCoordinates);
	if (arrayOfCoordinates[0] > 180 || arrayOfCoordinates[0] < -180 || arrayOfCoordinates[1] > 90 || arrayOfCoordinates[1] < -90) {
		return res.json({ success: false, message: 'Coordinates out of bound.' });
	};
	Chat.find({
		location: arrayOfCoordinates
	}, function (err, chats) {
		if (err) throw err;
		return res.json({ success: true, chats: chats});
	});
});
/*
	End
*/

/*
	+-------------+
	| Update Chat |	
	+-------------+
	> Update the current status of a chat
	
	Created at V0.1.0
	@params
		chat_id: the id of the chat the user tries to update
	@return
	@errors

*/
app.get('/updatechat', function (req, res) {
	var chat_id = req.query.chat_id || req.headers['chat_id'];
	if (!chat_id) {
		return res.json({ success: false, message: 'Chat id not provided.' });
	};
	Chat.findOne({
		_id: chat_id
	}, function (err, chat) {
		if (err) throw err;
		if (!chat) {
			return res.json({ success: false, message: 'Chat not found.' });
		};
		return res.json({ success: true, chat: chat });
	});
});

/*
	End
*/


/*
	+---------+
	| Sign Up |
	+---------+
	Sign up an account for a new user
	@params
		email: email address in form of <string>@<string>.<string>
		password: password should contain at least one of 0-9, a-z, A-Z, and has length of 6-16, inclusive.
	@return
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
		return res.json({ success: false, message: 'Email not provided.' })
	}
	if (!req.body.password) {
		return res.json({ success: false, message: 'Password not provided.' })
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
						return res.json({ 
							success: true,
							token: token,
							id: user._id
						});
					});	
				}); 			
			} else {
				return res.json({ success: false, message: 'Invalid password.' });
			};
		} else {
			return res.json({ success: false, message: 'Invalid email.' });
		};
	});
});


/*
	+-------------+
	| Skip Signup |
	+-------------+
	> The user may skip signup during alpha test, however his 

	Created at V0.0.1
	Updated at V0.0.2
	> Now it returns user's id after registration

	@params
		secret: the secret on client to bypass registration
	@return
		token: token for further request
	@errors
		success: false, message: 'Unauthorized registration.'

*/
app.post('/skipsignup', function (req, res) {
	if (req.body.secret != config.secureLogin) {
		return res.send({ success: false, message: 'Unauthorized registration.' });
	};
	var token = uuid.v1();
	var tmp = {
		email: "Anonymous",
		token: token
	};
	var user = new User(tmp);
	user.save(function (err, user) {
		if (err) throw err;
		return res.send({ success: true, token: token, id: user._id });	
	});
});

/*
	End
*/
/* 
	+---------+
	| Sign In |
	+---------+
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
						return res.json({
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
	+------------------+
	| Create Institute |
	+------------------+
	Created at V0.0.1
	@params
		secret: the secret on server to upload maps
		name: the name of the institute
		coordinate1: the coordinate of a vertex of the institute
		coordinate2: the coordinate of a vertex of the institute
		coordinate3: the coordinate of a vertex of the institute
		coordinate4: the coordinate of a vertex of the institute
	@return
		<name> is created successfully.
	@errors
		'Upload unauthorized!'
		'Upload failed, coordinates not floats.'
		'Upload failed, institute exists.'
*/
app.get('/createinstitute', function (req, res) {
	var html = '<form action="/createinstitute" method="post">' +

	'Secret:' +
	'<input type="password" name="secret" placeholder="Password" />' +
	'<br><br>' +

	'Name:' +
	'<input type="text" name="name" placeholder="UCBerkeley" />' +
	'<br><br>' +


	'<button type="submit">Submit</button>' +
	'</form>';        
	return res.send(html);	
});

app.post('/createinstitute', function (req, res) {
	if (req.body.secret != config.secureUpload) { 
		var html = 'Upload unauthorized!';
		return res.send(html);
	};	
	Institute.findOne({
		name: req.body.name
	}, function (err, institute) {
		if (err) throw err;
		if (institute) {
			var html = 'Upload failed, institute exists.';
			return res.send(html);	
		} else {
			var schema = {
				name: req.body.name,
				buildings: []
			};
			var institute = new Institute(schema);
			institute.save(function (err) {
				if (err) throw err;
				var html = req.body.name + ' is created successfully.';
				return res.send(html);
			});
		};
	});
});
/*
	End
*/



/*
	+---------------------+
	| Get Institute Names |
	+---------------------+
	> Get a list of all institutes

	Created at V0.0.1
	@params
		token: user token
	@return
		success: true, institutes: institutes
	@errors

*/
app.get('/getinstitutenames', function (req, res) {
	Institute.find({}, function (err, institutes) {
		if (err) throw err;
		async.map(institutes,
			function (institute, callback) {
				callback(err, institute.name)
			},
			function (err, results) {
				return res.json({ success: true, institutes: results });
			});
	});
});
/*
	End
*/

/*
	+-----------------+
	| Create Building |
	+-----------------+
	> Create a building that belongs to the given institute.
	> The fourCoordinates is for IOS and twoCoordinates is for Android.

	Created at V0.0.1
	@params
		secret: the secret on server to upload maps
		buildingname: the name of the building
		institutename: the name of the institute the building belongs to
		defaultfloor: the url to image on the map overlay
		coordinate1: the coordinate of a vertex of the building
		coordinate2: the coordinate of a vertex of the building
		coordinate3: the coordinate of a vertex of the building
		coordinate4: the coordinate of a vertex of the building
	@return
		<buildingname> uploaded.
	@errors
		'Upload unauthorized!'
		'Upload failed, building exists.'
		'Upload failed, institute not provided.'
		'Upload failed, building not provided.'
		'Upload failed, default floor not provided.'
		'Upload failed, institute not found.'
		'Upload failed, coordinates not floats.'
*/
app.get('/createbuilding', function (req, res) {
	var html = '<form action="/createbuilding" method="post">' +

	'Secret:' +
	'<input type="password" name="secret" placeholder="Password" />' +
	'<br><br>' +

	'Building Name:' +
	'<input type="text" name="buildingname" placeholder="Evans Hall" />' +
	'<br><br>' +

	'Institute Name:' +
	'<input type="text" name="institutename" placeholder="UCBerkeley" />' +
	'<br><br>' +

	'Default Floor:' +
	'<input type="text" name="defaultfloor" placeholder="url to default floor" />' +
	'<br><br>' +

	'Two coordinates(SW, NE) <br>' +
	'Coordinate SW:' +
	'<input type="text" name="coordinatesw" placeholder="1.234,2.345" />' +
	'<br><br>' +
	'Coordinate NE:' +
	'<input type="text" name="coordinatene" placeholder="1.234,2.345" />' +
	'<br><br>' +

	'Height:' +
	'<input type="text" name="height" placeholder="8500" />' +
	'<br><br>' +

	'Width:' +
	'<input type="text" name="width" placeholder="6500" />' +
	'<br><br>' +

	'Bearing:' +
	'<input type="text" name="bearing" placeholder="50" />' +
	'<br><br>' +

	'Anchor coordinate:' +
	'<input type="text" name="location" placeholder="1.234,2.345" />' +
	'<br><br>' +

	'Four coordinates<br>' + 
	'Coordinate1:' +
	'<input type="text" name="coordinate1" placeholder="1.234,2.345" />' +
	'<br><br>' +
	'Coordinate2:' +
	'<input type="text" name="coordinate2" placeholder="1.234,2.345" />' +
	'<br><br>' +
	'Coordinate3:' +
	'<input type="text" name="coordinate3" placeholder="1.234,2.345" />' +
	'<br><br>' +
	'Coordinate4:' +
	'<input type="text" name="coordinate4" placeholder="1.234,2.345" />' +
	'<br><br>' +


	'<button type="submit">Submit</button>' +
	'</form>';        
	return res.send(html);		
});
app.post('/createbuilding', function (req, res) {
	if (req.body.secret != config.secureUpload) { 
		var html = 'Upload unauthorized!';
		return res.send(html);
	};
	Building.findOne({
		name: req.body.buildingname
	}, function (err, building) {
		if (err) throw err;
		if (building) {
			var html = 'Upload failed, building exists.';
			return res.send(html);
		} else {
			if (!req.body.institutename) {
				var html = 'Upload failed, institute not provided.';
				return res.send(html);
			};
			if (!req.body.buildingname) {
				var html = 'Upload failed, building not provided.';
				return res.send(html);
			};
			if (!req.body.defaultfloor) {
				var html = 'Upload failed, default floor not provided.';
				return res.send(html);
			};
			if (!req.body.height) {
				var html = 'Upload failed, height not provided.';
				return res.send(html);
			};
			if (!req.body.width) {
				var html = 'Upload failed, width not provided.';
				return res.send(html);
			};
			if (!req.body.bearing) {
				var html = 'Upload failed, bearing not provided.';
				return res.send(html);
			};	
			if (!req.body.location) {
				var html = 'Upload failed, location not provided.';
				return res.send(html);
			};			
			Institute.findOne({
				name: req.body.institutename
			}, function (err, institute) {
				if (err) throw err;
				if (!institute) {
					var html = 'Upload failed, institute not found.';
					return res.send(html);
				};
				if (!req.body.coordinate1) {
					var html = 'Upload failed, coordinates not provided.';
					return res.send(html);
				};
				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.coordinate1.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, coordinates not floats.';
						return res.send(html);
					};
					arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[i]);
					var coordinate1 = arrayOfCoordinates;
				};
				if (!req.body.coordinate2) {
					var html = 'Upload failed, coordinates not provided.';
					return res.send(html);	
				};

				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.coordinate2.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, coordinates not floats.';
						return res.send(html);			
					};
					arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[i]);
					var coordinate2 = arrayOfCoordinates;
				};
				if (!req.body.coordinate3) {
					var html = 'Upload failed, coordinates not provided.';
					return res.send(html);	
				};

				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.coordinate3.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, coordinates not floats.';
						return res.send(html);			
					};
					arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[i]);
					var coordinate3 = arrayOfCoordinates;
				};
				if (!req.body.coordinate4) {
					var html = 'Upload failed, coordinates not provided.';
					return res.send(html);	
				};
				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.coordinate4.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, coordinates not floats.';
						return res.send(html);			
					};
					arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[i]);
					var coordinate4 = arrayOfCoordinates;
				};

				if (!req.body.coordinatesw) {
					var html = 'Upload failed, coordinates not provided.';
					return res.send(html);	
				};
				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.coordinatesw.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, coordinates not floats.';
						return res.send(html);			
					};
					arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[i]);
					var coordinatesw = arrayOfCoordinates;
				};
				if (!req.body.coordinatene) {
					var html = 'Upload failed, coordinates not provided.';
					return res.send(html);	
				};
				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.coordinatene.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, coordinates not floats.';
						return res.send(html);			
					};
					arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[i]);
					var coordinatene = arrayOfCoordinates;
				};
				var arrayOfCoordinates = [];
				var arrayOfCoordinatesInString = req.body.location.split(',');
				for (var i=0; i < 2; i++) {
					if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
						var html = 'Upload failed, location not floats.';
						return res.send(html);			
					};
					arrayOfCoordinates[1-i] = parseFloat(arrayOfCoordinatesInString[i]);
					var location = arrayOfCoordinates;
				};
				if (isNaN(parseFloat(req.body.height))) {
					var html = 'Upload failed, height not floats.';
					return res.send(html);			
				};
				if (isNaN(parseFloat(req.body.width))) {
					var html = 'Upload failed, width not floats.';
					return res.send(html);			
				};
				if (isNaN(parseFloat(req.body.bearing))) {
					var html = 'Upload failed, bearing not floats.';
					return r.send(html);			
				};
				var height = parseFloat(req.body.height);
				var width = parseFloat(req.body.width);
				var bearing = parseFloat(req.body.bearing);
				var schema = {
					name: req.body.buildingname,
					floors: [],
					fourCoordinates: {
						coordinate1: coordinate1,
						coordinate2: coordinate2,
						coordinate3: coordinate3,
						coordinate4: coordinate4
					},
					twoCoordinates: {
						coordinatesw: coordinatesw,
						coordinatene: coordinatene
					},
					height: height,
					width: width,
					bearing: bearing,
					location: location,
					defaultfloor: req.body.defaultfloor
				};
				var building = new Building(schema);
				building.save(function (err, building) {
					if (err) throw err;
					institute.buildings.push(building.name);
					institute.save(function (err, institute) {
						if (err) throw err;
					});
					var html = building.name + ' uploaded.';
					return res.send(html);		 			
				});
			});
		};
	});
});

/*
	End
*/

/*
	+--------------------+
	| Get Building Names |
	+--------------------+
	> Get a list of all buildings

	Created at V0.0.1
	@params
		token: user token
	@return
		success: true, buildings: buildings
	@errors

*/
app.get('/getbuildingnames', function (req, res) {
	Building.find({}, function (err, buildings) {
		if (err) throw err;
		async.map(buildings,
			function (building, callback) {
				callback(err, building.name)
			},
			function (err, results) {
				return res.json({ success: true, buildings: results });
			});
	});
});
/*
	End
*/



/*
	+----------------------+
	| Get Buildings Nearby |
	+----------------------+
	> Given the coordinate of a location, the server responds with
	> a list of the buildings near that location. Including their names,
	> default floor plans, and coordinates.

	Created at V0.0.1
	@params
		token: user token
		coordinate: the numeral coordinate of a location (lat, lng)
	@return
		 success: true, buildings: buildings
	@errors
		 success: false, message: 'Coordinate not provided.'
		 success: false, message: 'Coordinate not float.'
		 success: false, message: 'Coordinates out of bound.'
*/
app.get('/getbuildingsnearby', function (req, res) {
	var coordinate = req.query.coordinate || req.headers['coordinate'];
	if (!coordinate) {
		return res.json({ success: false, message: 'Coordinate not provided.' })
	};
	var arrayOfCoordinates = [];
	var arrayOfCoordinatesInString = coordinate.split(',');
	for (var i=0; i < 2; i++) {
		if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
			return res.json({ success: false, message: 'Coordinate not float.' })
		}
		arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[1 - i]);
	};
	console.log(arrayOfCoordinates);
	if (arrayOfCoordinates[0] > 180 || arrayOfCoordinates[0] < -180 || arrayOfCoordinates[1] > 90 || arrayOfCoordinates[1] < -90) {
		return res.json({ success: false, message: 'Coordinates out of bound.' });
	};
	Building.find({
		location: { '$nearSphere': arrayOfCoordinates,
		'$maxDistance': 1/(6378 * 4)
	}
	}, function (err, buildings) {
	if (err) throw err;
	return res.json({ success: true, buildings: buildings });
	});
});
/*
	End
*/

/*
	+-------------------+
	| Get Building Maps |
	+-------------------+
	> Get all the floorplans according to the given the coordinate of the building

	Created at V0.0.1
	@params
		token: user token
		location: the exact coordinate of the building
	@return
		success: true, floors: floors
	@errors
*/
app.get('/getbuildingmaps', function (req, res) {
	if (!req.query.location) {
		return res.json({ success: false, message: "Location not provided." })
	};
	var arrayOfCoordinates = [];
	var arrayOfCoordinatesInString = req.query.location.split(',');
	for (var i=0; i < 2; i++) {
		if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
			var html = 'Location not floats.';
			return res.send(html);			
		};
		arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[1 - i]);
		var coordinate = arrayOfCoordinates;
	};
	Building.findOne({
		location: coordinate
	}, function (err, building) {
		if (err) throw err;
		if (!building) {
			return res.json({ success: false, message: "Building not found." })
		} else {
			async.map(building.floors, 
			function (id, callback) {
				console.log(id);
				Floor.findOne({
					_id: id
				}, function (err, floor) {
					console.log(floor.name);
					callback(err, floor);
				})
			}, function (err, results) {
					return res.json({ success: true, floors: results});
			});		
		};
	});
});

/*
	End
*/

/*
	+--------------+
	| Create Floor |
	+--------------+
	> Authorized individuals can upload floors to server, with the
	> secret provided, the name of building, the name of institute,
	> and the url to the floor plan.

	Created at V0.0.1
	@params
		secret: the secret on server to upload maps
		buildingname: the name of the building
		institutename: the name of the institute the building belongs to
		floorname: the name of the floor, can be number
		url: the url to the image of floor plan
	@return
		<floorname> uploaded.
	@errors
		'Upload unauthorized!
		'Upload failed, institute not provided.'
		'Upload failed, building not provided.'
		'Upload failed, floor not provided.'
		'Upload failed, url not provided.'
		'Upload failed, institute not found.'
		'Upload failed, building not found.'
		'Upload failed, floor exists.'
*/
app.get('/createfloor', function (req, res) {
	var html = '<form action="/createfloor" method="post">' +

	'Secret:' +
	'<input type="password" name="secret" placeholder="Password" />' +
	'<br><br>' +

	'Building Name:' +
	'<input type="text" name="buildingname" placeholder="Evans Hall" />' +
	'<br><br>' +

	'Institute Name:' +
	'<input type="text" name="institutename" placeholder="UCBerkeley" />' +
	'<br><br>' +

	'Floor Name:' +
	'<input type="text" name="floorname" placeholder="1" />' +
	'<br><br>' +

	'Floor Map URL:' +
	'<input type="text" name="url" placeholder="url://floor.jpg" />' +
	'<br><br>' +

	'<button type="submit">Submit</button>' +
	'</form>';        
	return res.send(html);		
});
app.post('/createfloor', function (req, res) {
	if (req.body.secret != config.secureUpload) { 
		var html = 'Upload unauthorized!';
		return res.send(html);
	};	
	if (!req.body.institutename) {
		var html = 'Upload failed, institute not provided.';
		return res.send(html);		
	};
	if (!req.body.buildingname) {
		var html = 'Upload failed, building not provided.';
		return res.send(html);		
	};
	if (!req.body.floorname) {
		var html = 'Upload failed, floor not provided.';
		return res.send(html);		
	};
	if (!req.body.url) {
		var html = 'Upload failed, url not provided.';
		return res.send(html);		
	};
	Institute.findOne({
		name: req.body.institutename
	}, function (err, institute) {
		if (err) throw err;
		if (!institute) {
			var html = 'Upload failed, institute not found.';
			return res.send(html);			
		} else {
			Building.findOne({
				name: req.body.buildingname
			}, function (err, building) {
				if (!building) {
					var html = 'Upload failed, building not found.';
					return res.send(html);	
				} else {
					Floor.find({
						'_id': { $in: building.floors }
					}, function (err, floors) {
						if (Object.getOwnPropertyNames(floors).length === 0) {
							var html = 'Upload failed, floor exists.';
							return res.send(html);
						} else {
							var schema = {
								name: req.body.floorname,
								map: req.body.url
							};
							var floor = new Floor(schema);
							floor.save(function (err, floor) {
								if (err) throw err;
								building.floors.push(floor._id);
								building.save(function (err) {
									if (err) throw err;
									var html = floor.name + ' uploaded.';
									return res.send(html);	
								});		
							});
						};
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
	+---------------------------------+
	| Token Authentication Middleware |
	+---------------------------------+
	Created at V0.0.1
	@params
		token: token as given when sign in or sign up
	@return
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
		return res.send({ 
			success: false, 
			message: 'No token provided.' 
		});
	};
});
/*
	End
*/

/*
	+-------------+
	| Create Chat |
	+-------------+
	> Create a chat so other users can join

	Created at V0.1.0
	@params
		name: give a name to this chat, may be the room number
		location: the location of the chat
	@return
	@errors

*/
app.post('/createchat', function (req, res) {
	if (!req.body.name) {
		return res.json({ success: false, message: 'Name not provided.'});
	};
	if (!req.body.location) {
		return res.json({ success: false, message: 'Location not provided.'});
	};
	var arrayOfCoordinates = [];
	var arrayOfCoordinatesInString = req.body.location.split(',');
	for (var i=0; i < 2; i++) {
		if (isNaN(parseFloat(arrayOfCoordinatesInString[i]))) {
			var html = 'Upload failed, coordinates not floats.';
			return res.send(html);			
		};
		arrayOfCoordinates[i] = parseFloat(arrayOfCoordinatesInString[1 - i]);
		var location = arrayOfCoordinates;
	};
	Building.findOne({
		location: location
	}, function (err, building) {
		if (err) throw err;
		if (building) {
			User.findOne({
				_id: req.user_id
			}, function (err, user) {
				if (err) throw err;
				if (!user) {
					return res.json({ success: false, message: 'Create chat failed. User not found.' });
				};
				var participants = [];
				participants[0] = user._id;
				var schema = {
					name: req.body.name,
					location: location,
					active: true,
					participants: participants
				};
				var chat = new Chat(schema);
				chat.save(function (err, chat) {
					if (err) throw err;
					return res.json({ success: true, chat_id: chat._id })
				});
			});
	
		} else {
			return res.json({ success: false, message: 'Create chat failed. Building not found.' });
		};
	});
	
});
/*
	End
*/
/*
	+-----------+
	| Join chat |
	+-----------+
	> Join an existing chat

	Created at V0.1.0
	@params
		chat_id: the id of the chat the user tries to join
	@return
	@errors

*/
app.post('/joinchat', function (req, res) {

	User.findOne({
		_id: req.user_id
	}, function (err, user) {
		if (err) throw err;
		if (!user) {
			return res.json({ success: false, message: 'Join chat failed. User not found.' });
		};
		Chat.findOne({
			_id: req.body.chat_id
		}, function (err, chat) {
			if (err) throw err;
			if (!chat) {
				return res.json({ success: false, message: 'Join chat failed. Chat not found.' });
			};
			if (!chat.active) {
				return res.json({ success: false, message: 'Join chat failed. Chat not active.' });
			};
			if (chat.participants.indexOf(user._id) > -1) {
				return res.json({ success: false, message: 'Join chat failed. Already in.' });
			};
			chat.participants.push(user._id);
			chat.save(function (err) {
				if (err) throw err;
				return res.json({ success: true, message: 'Join chat successfully.' });
			});
		});
	});
});
/*
	End
*/

/*
	+-----------+
	| Quit Chat |
	+-----------+
	> Quit the chat the user joined before

	Created at V0.1.0
	@params
		chat_id: the id of the chat to quit
	@return
	@errors

*/
app.post('/quitchat', function (req, res) {
	if (!req.body.chat_id) {
		return res.json({ success: false, message: 'Chat id not provided.' });
	};
	Chat.findOne({
		_id: req.body.chat_id
	}, function (err, chat) {
		if (err) throw err;
		if (!chat) {
			return res.json({ success: false, message: 'Chat not found.' });
		};
		var index = chat.participants.indexOf(req.user_id);
		console.log(req.user_id);
		if (index > -1) {
			chat.participants.splice(index, 1);
			if (chat.participants.length == 0) {
				chat.remove();
			};
			chat.save(function (err) {
				if (err) throw err;
				return res.json({ success: true, message: 'Quit chat.' });
			})
			
		} else {
			return res.json({ success: false, message: 'Not in chat.' });
		};
		
	});	
});
/*
	End
*/

/*
	+-----------------+
	| Upload Location |
	+-----------------+
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
	+-----------------------------+
	| Initialize Facebook Friends |
	+-----------------------------+
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
	+-----------------------------+
	| Create Group And Sent Event |
	+-----------------------------+
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
	+---------------------+
	| Accept Group Invite |
	+---------------------+
	
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
	Server setup
*/
	var server = app.listen(process.env.PORT || 8080, function () {
		var host = server.address().address;
		var port = server.address().port;
		console.log('Architek listening at http://%s:%s', host, port);
	});
