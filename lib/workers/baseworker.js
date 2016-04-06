/*global module, require*/

var Monitor = require('../monitor.js'),
  logger = require('../logger.js');

var _ = require('underscore');


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

  this.cstats = {};
  this.cstats.clients_tried = 0;
  this.cstats.clients_opened = 0;
  this.cstats.clients_closed = 0;
  this.cstats.clients_failed = 0;
  this.cstats.messages_tried = 0;
  this.cstats.messages_sent = 0;
  this.cstats.messages_failed = 0;
  this.cstats.messages_reply_received = 0;
  this.cstats.messages_reply_failed = 0;

  var perSecondId = setInterval(function() {
    _this.launchConnections(options.connectionPerSecond);
  }, 1000);

  setTimeout(function() {
    _this.totalTimeDone = true;
    clearInterval(perSecondId);
  }, options.totalTime * 1000);

};

var statuses = ["clients_tried",  "clients_opened",  "clients_closed",  "clients_failed",  "messages_tried",  "messages_sent",  "messages_failed",  "messages_reply_received",  "messages_reply_failed"];
BaseWorker.prototype.updateStatus = function(id) {

  if(statuses.indexOf(id) < 0) {
    throw new Error('invalid update status id');
  }
  this.cstats[id]++;
  sendStatusUpdateToParent(this);
};

var sendStatusUpdateToParent = _.throttle(function(worker) {
  process.send({
    action: "status",
    status: worker.cstats
  });
}, 300); // every 1000 ms


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
  this.updateStatus('clients_tried');
  var hasFailed = false;
  var creationTimeout = setTimeout(function() {
    hasFailed = true;
    _this.updateStatus('clients_failed');
  }, 1500);
  this.createClient(function (err, client) {
    if(hasFailed) {
      return;
    }
    if(creationTimeout) {
      clearTimeout(creationTimeout);
    }

    client.wbStats = {};
    client.wbStats.initTime = initTime;
    client.wbStats.openTime = new Date().getTime();
    if(err) {
      this.updateStatus('clients_failed');
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
      this.updateStatus('clients_failed');
      client.wbStats.openFailed = true;
      client.wbStats.error = err;
      return
    }
    _this.updateStatus('clients_opened');
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
            _this.updateStatus('messages_failed');
            msg.sendFailed = true;
          }
          else {
            _this.updateStatus('messages_sent');
            msg.sentTime = new Date().getTime();
          }
        }, _this.options.messageReply ? function(err) {
          if(err) {
            _this.updateStatus('messages_reply_failed');
            msg.replyFailed = true;
          }
          else {
            _this.updateStatus('messages_reply_received');
            msg.replyTime = new Date().getTime();
          }

        } : undefined];
        _this.updateStatus('messages_tried');
        sendMessage.apply(sendMessageContext, sendMessageArgs);
      })();
    }
  });


  setTimeout(function() {
    _this.stats.push(client.wbStats);
    _this.closeClient(client, function(err) {
      _this.updateStatus('clients_closed');
      var i = _this.clients.indexOf(client);
      if(i >= 0) {
        _this.clients.splice(i, 1)
      }

      if(_this.totalTimeDone && !_this.clients.length) {
        setTimeout(function() {
          _this.sendComplete();
        }, 500); // let it update the clients_closed data first
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
