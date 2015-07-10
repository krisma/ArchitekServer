var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var roomSchema = new Schema ({
  number        : String,
  name          : String,
  logo          : String
});

module.exports = mongoose.model('Room', roomSchema);
