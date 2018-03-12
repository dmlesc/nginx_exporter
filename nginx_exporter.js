'use strict';
var log = require('./log');
process.on('uncaughtException', (err) => { log(err); });

const { spawn } = require('child_process');

var m = require('./metrics');
m();
m.register('requests_total');
m.register('body_bytes_sent_total');
m.register('request_time_ms_total');
m.register('request_count', 'status');

const tail_file = '/var/log/nginx/access.log';

function spawns(file) {
  const tcpdump = spawn('tail', ['-f', file]);

  tcpdump.stderr.on('data', (data) => { log(`stderr: ${data}`); });
  tcpdump.on('close', (code) => { log('close:', code); });
  
  tcpdump.stdout.on('data', (data) => {
    log(data.toString());
    var line = data.toString().split(' ');
    //var method = line[5].slice(1);
    var status = line[8];
    var body_bytes_sent = Number(line[9]);
    var response_time = sec2ms(line[line.length - 1]);
    
    log(status + ' - ' + body_bytes_sent + ' - ' + response_time);
    
    m.inc('requests_total');
    m.inc('body_bytes_sent_total', body_bytes_sent);
    m.inc('request_time_ms_total', response_time);
    m.incLabels('request_count', 'status', status);
  });
}

function sec2ms(str) {
  var str = str.split('.');
  var seconds = Number(str[0]);
  var decimal = Number(str[1]);
  var ms = (seconds * 1000) + decimal;
  return ms;
}

spawns(tail_file);