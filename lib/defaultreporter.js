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

  if(result.activeConnectionsOnFailure && result.activeConnectionsOnFailure.c1) {

    this.outputStream.write('\n');

    if(result.activeConnectionsOnFailure.c1) {
      this.outputStream.write('# active connection when 1 client failed: '+result.activeConnectionsOnFailure.c1+'\n');
    }
    if(result.activeConnectionsOnFailure.c10) {
      this.outputStream.write('# active connection when 10 clients failed: '+result.activeConnectionsOnFailure.c10+'\n');
    }
    if(result.activeConnectionsOnFailure.c100) {
      this.outputStream.write('# active connection when 100 clients failed: '+result.activeConnectionsOnFailure.c100+'\n');
    }
    if(result.activeConnectionsOnFailure.c1000) {
      this.outputStream.write('# active connection when 1000 clients failed: '+result.activeConnectionsOnFailure.c1000+'\n');
    }
  }

};

module.exports = DefaultReporter;