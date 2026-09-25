// Compatibility wrapper.
// The project uses one authenticated Socket.IO gateway: ./index.js.
// Do not create a second Socket.IO Server here.
module.exports = require('./index');
