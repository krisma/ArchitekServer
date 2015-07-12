var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var floorSchema = new Schema ({
  name:         String,
  map:       	String,
});
module.exports = mongoose.model('Floor', floorSchema);
