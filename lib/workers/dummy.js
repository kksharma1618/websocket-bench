/*global module, require*/

var BaseWorker = require('./baseworker.js'),
  util = require('util'),
  logger = require('../logger.js');

var DummyWorker = function (server, generator) {
  DummyWorker.super_.apply(this, arguments);
};

util.inherits(DummyWorker, BaseWorker);


var index = 0;
var dummyLog = false;
DummyWorker.prototype.createClient = function (callback) {

  var client = {};
  index++;

  client.id = 'dummy'+index;


  setTimeout(function() {
    client.isOpened = true;
    dummyLog && logger.info('dummy client created '+client.id);
    callback(false, client);
  }, 50);

  return client;
};

DummyWorker.prototype.closeClient = function (client, callback) {

  setTimeout(function() {
    client.isOpened = false;
    client.isClosed = true;
    dummyLog && logger.info('dummy client closed '+client.id);
    callback && callback(false, client);
  }, 50);
};

DummyWorker.prototype.sendMessage = function(client, sentCallback, replyCallback) {
  setTimeout(function() {
    sentCallback();
  }, 70);

  if(replyCallback) {
    setTimeout(function() {
      replyCallback();
    }, 145);
  }
};

module.exports = DummyWorker;