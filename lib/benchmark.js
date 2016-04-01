/*global module, require*/
var Monitor = require('./monitor.js'),
  StopWatch = require('./stopwatch.js'),
  Steps = require('./steps.js'),
  logger = require('./logger.js');

var fs = require('fs-extra');
var path = require('path');
var tmpFolder = require('os').tmpdir();
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
  var cp = require('child_process');

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

  var optionsFile = path.resolve(tmpFolder, 'websocketbenchworkerconfig.json');
  fs.outputJsonSync(optionsFile, workerOptions);



  for (var i = 0; i < program.worker; i++) {
    this.workers[i] = cp.fork(__dirname + '/worker.js', [optionsFile
    ]);
  }
};


Benchmark.prototype._onMessage = function(message) {
  if (message.action === 'done') {
    this._processResult(message.result);
  }
};

Benchmark.prototype._processResult = function (result) {
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
