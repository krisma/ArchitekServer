var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var instituteSchema = new Schema ({
	name:               { type: String, index: true },
	buildings:          [String],
	coordinates: {
		coordinate1: [Number],
		coordinate2: [Number],
		coordinate3: [Number],
		coordinate4: [Number]
	}
});

module.exports = mongoose.model('Institute', instituteSchema);
