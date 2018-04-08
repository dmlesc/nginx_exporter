'use strict';
const log = require('./log');
process.on('uncaughtException', (err) => { log('uncaught', err.stack); });

const port = 9113;
const ip = '0.0.0.0';
const http = require('http');
const proc_prefix = 'nginx_exporter_process_';
const prefix = 'nginx_';
var register = {};

var metrics = () => {  
  var start_cpu_usage = process.cpuUsage();
  var cpu_usage_user = 0;
  var cpu_usage_system = 0;

  const server = http.createServer((req, res) => {
    //log(new Date().toJSON() + ' - ' + req.url);
    var code = 200;
    var data = '';
  
    if (req.url == '/metrics') {
      const uptime = process.uptime();
      const mem = process.memoryUsage();
      const cpu = process.cpuUsage(start_cpu_usage);
      start_cpu_usage = process.cpuUsage();
      cpu_usage_user += cpu.user;
      cpu_usage_system += cpu.system;
  
      data += proc_prefix + 'uptime ' + uptime + '\n'; 
      data += proc_prefix + 'memory{type="rss"} ' + mem.rss + '\n'; 
      data += proc_prefix + 'memory{type="heapUsed"} ' + mem.heapUsed + '\n'; 
      data += proc_prefix + 'memory{type="heapTotal"} ' + mem.heapTotal + '\n'; 
      data += proc_prefix + 'cpu{type="user"} ' + cpu.user + '\n'; 
      data += proc_prefix + 'cpu{type="system"} ' + cpu.system + '\n'; 
      data += proc_prefix + 'cpu_total{type="user"} ' + cpu_usage_user + '\n'; 
      data += proc_prefix + 'cpu_total{type="system"} ' + cpu_usage_system + '\n'; 

      data += collectMetrics();
    }
    else {
      code = 404;
      data = 'not found';
    }

    res.writeHead(code, { 'Content-Type': 'text/plain' });
    res.end(data);
  });
  
  server.listen(port, ip);
  log('metrics', 'ready to serve metrics');
}

metrics.register = (name, label, quantiles) => {
  register[name] = {start:0, value:0};
  if (label) {
    register[name]['labels'] = {};
    register[name]['labels'][label] = {};
  }
  //if (label == 'quantiles' && quantiles) {
  if (quantiles) {
    register[name].quantiles = quantiles;
    register[name].measurements = [];
  }
}

metrics.startTime = (name) => {
  register[name]['start'] = process.hrtime();
}

metrics.endTime = (name) => {
  var diff = process.hrtime(register[name]['start']);
  var ms = Math.round(diff[0] * 1000 + diff[1] / 1000000);
  register[name]['value'] += ms;
}

metrics.set = (name, value) => {
  register[name]['value'] = value;
}

metrics.inc = (name, v) => {
  var value = register[name]['value'];
  if (v) {
    value += v;
  }
  else {
    value++;
  }
  register[name]['value'] = value;
}

metrics.incLabels = (name, label, label_key) => {
  var value = 0;
  if (register[name]['labels'][label][label_key]) {
    value = register[name]['labels'][label][label_key];
  }
  value++;
  register[name]['labels'][label][label_key] = value;
}

metrics.quantiles = (name, measurement) => {
  register[name].measurements.push(measurement);
}

metrics.quantilesLabels = (name, label, label_key, measurement) => {
  if (!register[name]['labels'][label][label_key]) {
    register[name]['labels'][label][label_key] = [];
  }
  
  register[name]['labels'][label][label_key].push(measurement);
}

function collectMetrics() {
  var text = '';
        
  Object.keys(register).forEach( (metric_name) => {
    var name = prefix + metric_name;
    var metric = register[metric_name];

    if (metric['labels']) {
      var labels = metric['labels'];

      Object.keys(labels).forEach( (label) => {
        var label_keys = metric['labels'][label];

        if (metric.quantiles) {
          const q = metric.quantiles;

          if (label == 'quantiles') {
            var m = metric.measurements;
            text += calcQuantileValues(m, q, name);
            register[metric_name].measurements = [];
          }
          else {
            Object.keys(label_keys).forEach( (label_value) => {
              var m = label_keys[label_value];
              text += calcQuantileValues(m, q, name, label, label_value);
              register[metric_name]['labels'][label][label_value] = [];
            });
          }
        }
        else {
          Object.keys(label_keys).forEach( (label_value) => {
            var value = label_keys[label_value];
            text += name + '{' + label + '="' + label_value + '"} ' + value + '\n';
            register[metric_name]['labels'][label][label_value] = 0;
          });
        }
      });
    }
    else {
      text += name + ' ' + metric['value'] + '\n';
    }
  });

  return text;
}

function calcQuantileValues(m, q, name, label, label_value) {
  m.sort((a, b) => {return a - b});
  var text = '';

  for (var i=0; i<q.length; i++) {
    text += name + '{quantile="' + q[i] + '"';

    if (label) {
      text += ',' + label + '="' + label_value + '"';
    }

    var value = 0;

    if (m.length) {
      var index = Math.round(q[i] * m.length);
      if (index > 0) { index--; }
      value = m[index];
    }

    text +=  '} ' + value + '\n';
  }

  return text;
}


module.exports = metrics;