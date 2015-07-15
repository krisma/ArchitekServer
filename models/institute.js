var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var instituteSchema = new Schema ({
	name:               { type: String, index: true },
	buildings:          [String]
});

module.exports = mongoose.model('Institute', instituteSchema);
