var mongoose    = require('mongoose');
var Schema      = mongoose.Schema;
var ObjectId    = Schema.ObjectId;

var userSchema = new Schema ({
  email:             String,
  password:          String,
  userId:            String,
  token:             String,
  location:          [Number],
  groupId:           Schema.Types.ObjectId,
  groupInviteIds: 	 [Schema.Types.ObjectId],
  friends:           [Schema.Types.ObjectId],
  pendingFriends:    [Schema.Types.ObjectId]
});

module.exports = mongoose.model('User', userSchema);
 