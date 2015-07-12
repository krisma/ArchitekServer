var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var buildingSchema = new Schema ({
	name:               { type: String, index: true },
	floors:             [Schema.Types.ObjectId],
	coordinates: {
		coordinate1: [Number],
		coordinate2: [Number],
		coordinate3: [Number],
		coordinate4: [Number]
	},
	location: {
		type: [Number],
		index: '2dsphere'
	},
	defaultfloor: String
});
module.exports = mongoose.model('Building', buildingSchema);
