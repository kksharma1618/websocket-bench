/*global module, require*/

var Monitor = require('../monitor.js'),
  logger = require('../logger.js');


/**
 * BaseWorker constructor
 * @param {server}    server
 * @param {generator} generator
 * @param {verbose} verbose logging
 */
var BaseWorker = function (server, generator, verbose) {
  this.server = server;
  this.generator = generator;
  this.clients = [];
  this.stats = [];
  this.running = true;
  this.verbose = verbose;
};

/**
 * launch client creation and message
 * @param {number}    number
 * @param {messageNumber} messageNumber
 */
BaseWorker.prototype.launch = function (options) {
  var _this = this;
  this.options = options;

  var perSecondId = setInterval(function() {
    _this.launchConnections(options.connectionPerSecond);
  }, 1000);

  setTimeout(function() {
    _this.totalTimeDone = true;
    clearInterval(perSecondId);
  }, options.totalTime * 1000);

};

BaseWorker.prototype.sendComplete = function() {
  var _this = this;
  var result = {
    totalConnections: this.stats.length,
    failedConnections: 0,
    totalMessages: 0,
    failedMessages: 0,
    unrepliedMessages: 0,
    averageCreationLatency: 0,
    averageMessageSendingLatency: 0,
    averageMessageReplyLatency: 0
  };

  /*
  {
    initTime: t,
    openTime: t,
    openFailed: b,
    messages: [
      {
        initTime: t,
        sentTime: t,
        sendFailed: b,
        replyFailed: b,
        replyTime: t
      }
    ]
  }
   */
  var creationLatency = 0;
  var messageSendingLatency = 0;
  var messageReplyLatency = 0;
  this.stats.forEach(function(s) {
    if(s.openFailed) {
      result.failedConnections++;
      return;
    }
    creationLatency += (s.openTime - s.initTime);

    if(s.messages && s.messages.length) {
      result.totalMessages += s.messages.length;
    }

    s.messages.forEach(function(m) {
      if(m.sendFailed) {
        result.failedMessages++;  
        return;
      }

      messageSendingLatency += (m.sentTime - m.initTime);

      if(_this.options.messageReply) {
        if(m.replyFailed) {
          result.unrepliedMessages++;
          return;
        }
        messageReplyLatency += (m.replyTime - m.sentTime);
      }
    });
  });

  result.averageCreationLatency = creationLatency ? Math.floor(creationLatency/(result.totalConnections - result.failedConnections)) : 0;

  result.averageMessageSendingLatency = messageSendingLatency ? Math.floor(messageSendingLatency / (result.totalMessages - result.failedMessages)) : 0;

  result.averageMessageReplyLatency = messageReplyLatency ? Math.floor(messageReplyLatency / (result.totalMessages - result.failedMessages - result.unrepliedMessages)) : 0;
  process.send({ action : 'done', result : result });
};

BaseWorker.prototype.launchConnections = function() {
  var monitor = new Monitor();
  for(var i=0; i<this.options.connectionPerSecond; i++) {
    this.launchConnection(monitor);
  }
};

BaseWorker.prototype.launchConnection = function(monitor) {
  var _this = this;
  var initTime = new Date().getTime();
  this.createClient(function (err, client) {
    client.wbStats = {};
    client.wbStats.initTime = initTime;
    client.wbStats.openTime = new Date().getTime();
    if(err) {
      client.wbStats.openFailed = true;
      client.wbStats.error = err;
      return;
    }
    _this.clients.push(client);
    _this._onClientCreation(client);
  });


};

BaseWorker.prototype.createClient = function (callback) {
  logger.error('Not implement method create client');
};

/**
 * Close Method (must be redifined if client doesnt have a disconnect method)
 */
BaseWorker.prototype.close = function () {
  this.running = false;

  for (var i = 0; i < this.clients.length; i++) {
    this.closeClient(this.clients[i]);
  }
};

BaseWorker.prototype.closeClient = function(client, next) {
  try {
    client.disconnect();
  }
  catch(e) {

  }
  next();
};

/**
 * _onClientCreation internal method
 * @api private
 */
BaseWorker.prototype._onClientCreation = function (client) {
  var _this = this;

  _this.generator.onConnect(client, function (err) {
    if(err) {
      client.wbStats.openFailed = true;
      client.wbStats.error = err;
      return
    }

    client.wbStats.messages = [];
    for (var msgSend = 0; msgSend < _this.options.messageNumber; msgSend++) {
      (function() {
        var msg = {};
        client.wbStats.messages.push(msg);
        msg.initTime = new Date().getTime();
        var sendMessage = _this.generator.sendMessage;
        var sendMessageContext = _this.generator;

        if(!_this.generator.hasSendMessage && _this.sendMessage) {
          sendMessage = _this.sendMessage;
          sendMessageContext = _this;
        }

        var sendMessageArgs = [client, function (err) {
          if(err) {
            msg.sendFailed = true;
          }
          else {
            msg.sentTime = new Date().getTime();
          }
        }, _this.options.messageReply ? function(err) {
          if(err) {
            msg.replyFailed = true;
          }
          else {
            msg.replyTime = new Date().getTime();
          }

        } : undefined];

        sendMessage.apply(sendMessageContext, sendMessageArgs);
      })();
    }
  });


  setTimeout(function() {
    _this.stats.push(client.wbStats);
    _this.closeClient(client, function(err) {
      var i = _this.clients.indexOf(client);
      if(i >= 0) {
        _this.clients.splice(i, 1)
      }

      if(_this.totalTimeDone && !_this.clients.length) {
        _this.sendComplete();
      }
    });
  }, this.options.connectionTime * 1000);
};

/**
 * _onMessageSend internal method
 * @api private
 */
BaseWorker.prototype._onMessageSend = function (monitor, err) {
  if (err) {
    monitor.msgFailed();
  } else {
    monitor.msgSend();
  }
};

/**
 * _testLaunchDone internal method
 * @api private
 */
BaseWorker.prototype._testLaunchDone = function (monitor, number, messageNumber) {
  if (monitor.counter === number && monitor.messageCounter === (monitor.results.connection * messageNumber)) {

    process.send({ action : 'done', monitor : monitor });

    return true;
  }

  return false;
};

module.exports = BaseWorker;
