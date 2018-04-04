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
      data += proc_prefix + 'process_cpu{type="user"} ' + cpu.user + '\n'; 
      data += proc_prefix + 'cpu{type="system"} ' + cpu.system + '\n'; 
      data += proc_prefix + 'cpu_total{type="user"} ' + cpu_usage_user + '\n'; 
      data += proc_prefix + 'cpu_total{type="system"} ' + cpu_usage_system + '\n'; 

      Object.keys(register).forEach( (metric) => {
        if (register[metric]['labels']) {
          var labels = register[metric]['labels'];

          Object.keys(labels).forEach( (label) => {
            if (label == 'quantiles') {
              var q = register[metric].quantiles;
              var m = register[metric].measurements;
              m.sort((a, b) => {return a - b});

              for (var i=0; i<q.length; i++) {
                var value = 0;

                if (m.length) {
                  var index = Math.round(q[i] * m.length);
                  if (index > 0) { index--; }
                    value = m[index];
                }

                data += prefix + metric + '{quantile="' + q[i] + '"} ' + value + '\n';
              }

              register[metric].measurements = [];
            }
            else {
              var label_values = register[metric]['labels'][label];

              Object.keys(label_values).forEach( (label_value) => {
                var value = label_values[label_value];
                data += prefix + metric + '{' + label + '="' + label_value + '"} ' + value + '\n';
                register[metric]['labels'][label][label_value] = 0;
              });
            }
          });
        }
        else {
          data += prefix + metric + ' ' + register[metric]['value'] + '\n';
        }
      });
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
  if (label == 'quantiles' && quantiles) {
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

metrics.incLabels = (name, label, label_value) => {
  var value = 0;
  if (register[name]['labels'][label][label_value]) {
    value = register[name]['labels'][label][label_value];
  }
  value++;
  register[name]['labels'][label][label_value] = value;
}

metrics.quantiles = (name, measurement) => {
  register[name].measurements.push(measurement);
}

module.exports = metrics;