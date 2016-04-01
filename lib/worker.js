/*global module, require, process*/

var logger = require('./logger');

var optionsFile = process.argv[2];

var options = require(optionsFile);

var
  server = options.server,
  generatorFile = options.generatorFile,
  workerType = options.type,
  verbose = options.verbose == 'true';

if (!generatorFile || generatorFile === 'undefined') {
  generatorFile = './generator.js';
}

var generator = require(generatorFile);
var BenchmarkWorker = null;

switch (workerType) {
  case 'socket.io':
    BenchmarkWorker = require('./workers/socketioworker.js');
    break;
  case 'engine.io':
	Worker = require('./workers/engineioworker.js');
	break;
  case 'faye':
    BenchmarkWorker = require('./workers/fayeworker.js');
    break;
  case 'primus':
    BenchmarkWorker = require('./workers/primusworker.js');
    break;
  case 'wamp':
    BenchmarkWorker = require('./workers/wampworker.js');
    break;
  case 'dummy':
    BenchmarkWorker = require('./workers/dummy.js');
    break;
  default:
    logger.error('error workerType ' + workerType);
}

var worker = new BenchmarkWorker(server, generator, verbose);
worker.launch(options);


process.on('message', function (message) {
  if (message.msg === 'close') {
    worker.close();
    process.exit();
  }
});

// On ctrl+c
process.on('SIGINT', function () {
  worker.close();
  setTimeout(function () {
    process.exit();
  }, 3000);
});

