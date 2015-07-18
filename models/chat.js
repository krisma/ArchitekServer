var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var chatSchema = new Schema ({
	name: String,
	participants: [Schema.Types.ObjectId],
	location: {
		type: [Number],
		index: '2dsphere'
	},
	active: Boolean
});
module.exports = mongoose.model('chat', chatSchema);
