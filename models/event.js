var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var eventSchema = new Schema ({
	title: String,
	content: String,
	location: {
		type: [Number],
		index: '2dsphere'
	},
	time: String
});
module.exports = mongoose.model('evnet', eventSchema);
