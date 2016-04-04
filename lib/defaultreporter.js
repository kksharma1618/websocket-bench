/*global module, require*/
var Table = require('cli-table');

/**
 * Class for display bench result
 */
var DefaultReporter = function (outputStream) {

  this.outputStream = outputStream || process.stdout;

};

DefaultReporter.prototype.report = function (result) {

  this.outputStream.write('\n\n');
  this.outputStream.write('Total Connections: ' + result.totalConnections + '\n');
  this.outputStream.write('Failed Connections: ' + result.failedConnections + '\n');
  this.outputStream.write('Total Messages: ' + result.totalMessages + '\n');
  this.outputStream.write('Failed Messages: ' + result.failedMessages + '\n');
  this.outputStream.write('UnReplied Messages: ' + result.unrepliedMessages + '\n');
  this.outputStream.write('Average Creation Latency (ms): ' + result.averageCreationLatency + '\n');
  this.outputStream.write('Average Message Sending Latency (ms): ' + result.averageMessageSendingLatency + '\n');
  this.outputStream.write('Average Message Reply Latency (ms): ' + result.averageMessageReplyLatency + '\n');

};

module.exports = DefaultReporter;