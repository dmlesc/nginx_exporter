'use strict';
var log = require('./log');
process.on('uncaughtException', (err) => { log(err); });

const { spawn } = require('child_process');

var m = require('./metrics');
m();
m.register('requests_count');
m.register('request_time_ms_sum');

//const tail_files = ['/var/log/nginx/access.log','/var/log/nginx/error.log'];
const tail_files = ['/var/log/nginx/access.log'];

function spawns(file) {
  const tcpdump = spawn('tail', ['-f', file]);

  tcpdump.stderr.on('data', (data) => { log(`stderr: ${data}`); });
  tcpdump.on('close', (code) => { log('close:', code); });
  
  tcpdump.stdout.on('data', (data) => {
    //log(data.toString());
    var line = data.toString().split(' ');
    var status = line[8];
    var response_time = sec2ms(line[line.length - 1]);
    
    log(status + ' - ' + response_time);
    
    m.inc('requests_count');
    m.inc('request_time_ms_sum', response_time);
  });
}

function sec2ms(str) {
  var str = str.replace(/\"/g, '').split('.'); 
  var seconds = Number(str[0]);
  var decimal = Number(str[1]);
  var ms = (seconds * 1000) + decimal;

  return ms;
}

for (var i=0; i<tail_files.length; i++) {
  spawns(tail_files[i]);
}