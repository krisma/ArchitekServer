var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var unitSchema = new Schema ({
  name          : String,
  coordinates   : [Number],
  maps          : [String],
  names        : [String]
});

module.exports = mongoose.model('Unit', unitSchema);
