/*global require, process*/

var Benchmark = require('./lib/benchmark.js'),
  DefaultReporter = require('./lib/defaultreporter.js'),
  fs = require('fs'),
  program = require('commander'),
  logger = require('./lib/logger');




program
  .version('0.0.3')
  .usage('[options] <server>')
  .option('-a, --total-time <n>', 'How long to run the test. In seconds. Defaults to 300', parseInt)
  .option('-b, --connection-time <n>', 'How long to keep connections open. In seconds. Defaults to 60', parseInt)
  .option('-c, --connections-per-second <n>', 'How many connections to open per second', parseInt)
  .option('-w, --worker <n>', 'number of worker', parseInt)
  .option('-g, --generator <file>', 'js file for generate message or special event')
  .option('-m, --message <n>', 'number of message for a client. Default to 0', parseInt)
  .option('-e, --message-reply', 'If provided then we will wait for message reply and record the time taken')
  .option('-o, --output <output>', 'Output file')
  .option('-t, --type <type>', 'type of websocket server to bench(socket.io, engine.io, faye, primus, wamp, dummy). Default to io. Dummy doesnt send anything. Its just for testing purpose. It just logs events')
  .option('-p, --transport <type>', 'type of transport to websocket(engine.io, websockets, browserchannel, sockjs, socket.io). Default to websockets')
  .option('-k, --keep-alive', 'Keep alive connection')
  .option('-v, --verbose', 'Verbose Logging')
  .parse(process.argv);

if (program.args.length < 1) {
  program.help();
}

var server = program.args[0];

// Set default value
if (!program.worker) {
  program.worker = 1;
}

if (!program.verbose) {
  program.verbose = false;
}

if (!program.totalTime) {
  program.totalTime = 5*60;
}

if (!program.connectionTime) {
  program.connectionTime = 60;
}

if (!program.connectionsPerSecond) {
  program.connectionsPerSecond = 20;
}

if (!program.generator) {
  program.generator = __dirname + '/lib/generator.js';
}

if (program.generator.indexOf('/') !== 0) {
  program.generator = process.cwd() + '/' + program.generator;
}

if (!program.message) {
  program.message = 0;
}

if (!program.messageReply) {
  program.messageReply = 0;
}

if (!program.type) {
  program.type = 'socket.io';
}

if (program.type === 'primus' && !program.transport) {
  program.transPort = 'websockets';
}

logger.info('Launch bench for ' + program.totalTime + ' seconds, ' + program.connectionsPerSecond + ' connections per second (each will stay alive for '+program.connectionTime+' seconds)');
logger.info(program.message + ' message(s) send by eachclient');
logger.info(program.worker + ' worker(s)');
logger.info('WS server : ' + program.type);

var options = {
  generatorFile : program.generator,
  type          : program.type,
  transport     : program.transport,
  keepAlive     : program.keepAlive,
  verbose       : program.verbose
};

if (program.verbose) {
  logger.debug("Benchmark Options " + JSON.stringify(options));
}

var outputStream = null;

if (program.output) {
  if (program.generator.indexOf('/') !== 0) {
    program.output = __dirname + '/' + program.generator;
  }
  outputStream = fs.createWriteStream(program.output);
}

var reporter = new DefaultReporter(outputStream);
var bench = new Benchmark(server, reporter, options);


var killAttempts = 0;
// On ctrl+c
process.on('SIGINT', function () {
  logger.info("\nGracefully stoping worker from SIGINT (Ctrl+C)");
  if(killAttempts > 10) {
    process.exit(1);
  }
  killAttempts++;

  setTimeout(function () {
    bench.terminate();
  }, 2000);


});

bench.launch(program);

