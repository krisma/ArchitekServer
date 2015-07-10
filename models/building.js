var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var buildingSchema = new Schema ({
  name          : String,
  floors        : [Schema.Types.ObjectId],
  coordinates   : [Number]
});

module.exports = mongoose.model('Building', buildingSchema);
