'use strict';
const log = require('./log');
process.on('uncaughtException', (err) => { log('uncaught', err, err.stack); });

const s_pos = 8;
const rt_pos = 23;

var m = require('./metrics');
m();
m.register('requests_total');
m.register('request_time_ms_total');
m.register('request_count', 'status');
m.register('request_time_ms', 'quantiles', [0.1, 0.5, 0.9, 0.99]);

const tail_file = '/var/log/nginx/access.log';
const Tail = require('tail').Tail;
const tail = new Tail(tail_file);

tail.on('line', (data) => {
  //log(data);
  var line = data.split(' ');
  var status = line[s_pos];
  var request_time = sec2ms(line[rt_pos]);
  
  log('log', status, request_time);
  
  m.inc('requests_total');
  m.inc('request_time_ms_total', request_time);
  m.incLabels('request_count', 'status', status);
  m.quantiles('request_time_ms', request_time);
});
 
tail.on('error', (err) => { log('ERROR', err, err.stack); });

function sec2ms(time) {
  var time = time.split('.');
  var ms = (Number(time[0]) * 1000) + Number(time[1]);
  return ms;
}