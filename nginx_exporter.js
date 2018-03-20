'use strict';
var log = require('./log');
process.on('uncaughtException', (err) => { log('uncaught', err, err.stack); });

var s_pos = 8;
var rt_pos = 23;

var m = require('./metrics');
m();
m.register('requests_total');
m.register('request_time_ms_total');
m.register('request_count', 'status');

const tail_file = '/var/log/nginx/access.log';
const Tail = require('tail').Tail;
const tail = new Tail(tail_file);
 
tail.on('line', (data) => {
  //log(data);
  var line = data.split(' ');
  var status = line[s_pos];
  var response_time = sec2ms(line[rt_pos]);
  
  log('log', status, response_time);
  
  m.inc('requests_total');
  m.inc('request_time_ms_total', response_time);
  m.incLabels('request_count', 'status', status);
});
 
tail.on("error", (err) => { log('ERROR', err, err.stack); });

function sec2ms(str) {
  var str = str.split('.');
  var seconds = Number(str[0]);
  var decimal = Number(str[1]);
  var ms = (seconds * 1000) + decimal;
  return ms;
}