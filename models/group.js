var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var groupSchema = new Schema ({
  name          : String,
  pin           : [Number],
  users         : String, //[objectId]
  active        : Boolean
});

module.exports = mongoose.model('Group', groupSchema);
