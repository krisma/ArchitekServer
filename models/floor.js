var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var floorSchema = new Schema ({
  number:       String,
  name:         String,
  map:       	String,
  matrix:       [Number],
  dimension:    [Number],
  rooms:        [Schema.Types.ObjectId]
});
module.exports = mongoose.model('Floor', floorSchema);
