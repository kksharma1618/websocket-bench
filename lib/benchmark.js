/*global module, require*/
var Monitor = require('./monitor.js'),
  StopWatch = require('./stopwatch.js'),
  Steps = require('./steps.js'),
  logger = require('./logger.js');

var _ = require('underscore');
var fs = require('fs-extra');
var path = require('path');
var tmpFolder = require('os').tmpdir();
var readline = require('readline');
var rl = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

var Table = require('cli-table');



/**
 * Constructor
 * @param {server} server to benchmark
 */
var Benchmark = function (server, reporter, options) {
  this.server = server;
  this.monitor = new Monitor();
  this.stopwatch = new StopWatch();
  this.steps = new Steps();
  this.workers = [];
  this.options = options || {};
  this.reporter = reporter;
};

/**
 * Launch
 */
Benchmark.prototype.launch = function (program) {
  var _this = this;
  var cp = require('child_process');

  this.launchedTime = new Date().getTime();

  var workerOptions = {
    connectionPerSecond: Math.ceil(program.connectionsPerSecond / program.worker),
    connectionTime: program.connectionTime,
    totalTime: program.totalTime,
    verbose: program.verbose,
    server: this.server,
    type: this.options.type,
    generatorFile: this.options.generatorFile,
    transport: this.options.transport,
    messageReply: program.messageReply,
    messageNumber: program.message
  };
  this.options.program = program;

  var optionsFile = path.resolve(tmpFolder, 'websocketbenchworkerconfig.json');
  fs.outputJsonSync(optionsFile, workerOptions);


  this.workerStats = {};
  for (var i = 0; i < program.worker; i++) {
    this.workers[i] = cp.fork(__dirname + '/worker.js', [optionsFile
    ]);
    this.workerStats['w'+i] = {
      "clients_tried": 0,
      "clients_opened": 0,
      "clients_closed": 0,
      "clients_failed": 0,
      "messages_tried": 0,
      "messages_sent": 0,
      "messages_failed": 0,
      "messages_reply_received": 0,
      "messages_reply_failed": 0
    };
    (function(i) {
      _this.workers[i].on('message', function(msg) {
        _this._onMessage('w'+i, msg);
      });
    })(i);
  }
};

var _processStatusReportThrottled = _.throttle(function(bm) {
  bm._processStatusReport();
}, 1000);
Benchmark.prototype._onMessage = function(workerId, message) {
  if (message.action === 'done') {
    this._processResult(message.result);
  }

  if (message.action === 'status') {
    this.workerStats[workerId] = message.status;
    _processStatusReportThrottled(this);
  }
};


var existingTableDisplay = false;
Benchmark.prototype._processStatusReport = function() {

  var t = new Date().getTime();

  var totalSec = parseInt((t - this.launchedTime) / 1000);
  var hours = parseInt( totalSec / 3600 ) % 24;
  var minutes = parseInt( totalSec / 60 ) % 60;
  var seconds = totalSec % 60;

  var timeString = (hours < 10 ? "0" + hours : hours) + "h:" + (minutes < 10 ? "0" + minutes : minutes) + "m:" + (seconds  < 10 ? "0" + seconds : seconds)+"s";

  var numWorkers = this.workers.length;
  var tableHead = ['Elapsed '+timeString, 'Aggregate'];

  var showWorkerStats = numWorkers > 1 && numWorkers < 4;

  if(showWorkerStats) {
    for(var i=0; i<numWorkers; i++) {
      tableHead.push('Worker '+(i+1));
    }
  }
  


  var stats = {
    "clients_tried": 0,
    "clients_opened": 0,
    "clients_closed": 0,
    "clients_failed": 0,
    "messages_tried": 0,
    "messages_sent": 0,
    "messages_failed": 0,
    "messages_reply_received": 0,
    "messages_reply_failed": 0
  };

  for(var i=0; i<numWorkers; i++) {
    for(var wk in this.workerStats['w'+i]) {
      if(this.workerStats['w'+i].hasOwnProperty(wk)) {
        stats[wk] = stats[wk] || 0;
        stats[wk] += this.workerStats['w'+i][wk];
      }
    }
  }

  if(this.options.verbose) {
    var s = '';
    for(var i in stats) {
      if(stats.hasOwnProperty(i)) {
        s+= i+' = '+stats[i]+' | ';
      }
    }
    console.log(s);
    return;
  }

  var tbl = new Table({
    head: tableHead
  });
  
  var labels = {
    "clients_tried": "Clients Tried",
    "clients_opened": "Clients Opened",
    "clients_active": "Clients Active".green,
    "clients_closed": "Clients Closed",
    "clients_failed": "Clients Failed".red,
    "messages_tried": "Messages Tried",
    "messages_sent": "Messages Sent",
    "messages_failed": "Messages Failed".red,
    "messages_reply_received": "Messages Reply Received",
    "messages_reply_failed": "Messages Reply Failed".red
  };

  for(var k in labels) {
    if(labels.hasOwnProperty(k)) {
      var a = [labels[k]];

      if(k == 'clients_active') {
        a.push( ((stats.clients_opened - stats.clients_closed - stats.clients_failed) + "").green );
      }
      else {
        a.push(stats[k]);
      }

      if(showWorkerStats) {
        for(var i=0; i<numWorkers; i++) {
          if(k == 'clients_active') {
            a.push( ((this.workerStats['w'+i].clients_opened - this.workerStats['w'+i].clients_closed - this.workerStats['w'+i].clients_failed) + "").green );
          }
          else {
            a.push(this.workerStats['w'+i][k]);
          }
        }
      }
      tbl.push(a);
    }
  }

  if(existingTableDisplay) {
    readline.moveCursor(process.stdout, 0, -1 * tbl.toString().split(/\r\n|\r|\n/).length);
    readline.clearScreenDown(process.stdout);
  }

  rl.write('\n');
  rl.write(tbl.toString());

  existingTableDisplay = true;
};

Benchmark.prototype._processResult = function (result) {
  this._processStatusReport();
  if(!this.workerResults) {
    this.workerResults = [];
  }
  this.workerResults.push(result);

  if(this.workerResults.length < this.workers.length) {
    return;
  }

  // all workers done, combine result into one
  var r = {
    totalConnections: 0,
    failedConnections: 0,
    totalMessages: 0,
    failedMessages: 0,
    unrepliedMessages: 0,
    averageCreationLatency: 0,
    averageMessageSendingLatency: 0,
    averageMessageReplyLatency: 0
  };
  this.workerResults.forEach(function(rs) {
    r.totalConnections += rs.totalConnections;
    r.failedConnections += rs.failedConnections;
    r.totalMessages += rs.totalMessages;
    r.failedMessages += rs.failedMessages;
    r.unrepliedMessages += rs.unrepliedMessages;
    r.averageCreationLatency += rs.averageCreationLatency;
    r.averageMessageSendingLatency += rs.averageMessageSendingLatency;
    r.averageMessageReplyLatency += rs.averageMessageReplyLatency;
  }); 
  r.averageCreationLatency = Math.floor(r.averageCreationLatency / this.workerResults.length);
  r.averageMessageSendingLatency = Math.floor(r.averageMessageSendingLatency / this.workerResults.length);
  r.averageMessageReplyLatency = Math.floor(r.averageMessageReplyLatency / this.workerResults.length);

  this.reporter.report(r);

  rl.close();
  this.close();
  process.exit();
};

/**
 * Terminate all running workers
 */
Benchmark.prototype.close = function () {
  for (var i = 0; i < this.workers.length; i++) {

    this.workers[i].send({ msg : 'close'});
  }
};

/**
 * Terminate and then display result
 */
Benchmark.prototype.terminate = function () {

  if (!this.options.keepAlive) {
    this.close();
  }
  logger.error('Terminated');
  // this._report();
};



module.exports = Benchmark;
