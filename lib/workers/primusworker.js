/*global module, require*/

var BaseWorker = require('./baseworker.js'),
  Primus = require('primus'),
  http = require('http'),
  util = require('util'),
  logger = require('../logger.js');

  var uid = require('node-uuid');

// Create a primus instance in order to obtain the client constructor.
var PrimusClient = new Primus(http.createServer(), {'transformer' : process.argv[5]}).Socket;

var PrimusWorker = function (server, generator) {
  PrimusWorker.super_.apply(this, arguments);
  this.replyCallbacks = {};
};

util.inherits(PrimusWorker, BaseWorker);

PrimusWorker.prototype.createClient = function (callback) {
  var self = this,
    client = new PrimusClient(this.server);

  client.on('open', function () {
    callback(false, client);
  });

  client.on('error', function (err) {
    if (self.verbose) {
      logger.error("Primus Worker error" + JSON.stringify(err));
    }

    callback(true, client);
  });

  if(this.options.messageReply) {
    client.on('data', function(m) {
      self.onData(m);
    });
  }

  return client;
};

PrimusWorker.prototype.closeClient = function (client, callback) {
    client.destroy();
    callback(null);
};

PrimusWorker.prototype.sendMessage = function (client, sentCallback, replyCallback) {
  var _this = this;
  var msg = {
    message: 'Some random message',
    id: uid.v4()
  };
  if(this.options.messageReply) {
    msg.echoback = 1;
    this.replyCallbacks[msg.id] = {
      callback: replyCallback,
      timeout: setTimeout(function() {
        _this.replyCallbacks[msg.id] = null;
        replyCallback('timedout');
      }, 5000)
    };
  }
  client.write(msg);
  sentCallback();
};

PrimusWorker.prototype.onData = function(m) {
  if(m && m.id && this.replyCallbacks[m.id]) {
    clearTimeout(this.replyCallbacks[m.id].timeout);
    this.replyCallbacks[m.id].callback.call();
  } 
};

module.exports = PrimusWorker;