'use strict';

const numRequests = process.argv[2];
const file = process.argv[3];
const interval = process.argv[4];


const request = require('request');

var requests = [];
var received = 0;
const uri = 'http://192.168.2.71/' + file;

var options = {
	uri: uri,
	method: 'GET'
};

for (var i=0; i<numRequests; i++) {
  requests.push(options);
}

function sendRequest() {
  if (requests.length) {
    var req = requests.shift();

    request(req, (err, res, body) => {
      if (err) { console.log(err); }
      else {
        //console.log(res);
        //console.log(res.statusCode, body);
        
        received++;
        console.log(res.statusCode, received);

        if (received % 1000 == 0) {
          console.log('received', received);
        }
      }
    });
  }
  else {
    console.log('done');
    clearInterval(send);
  }
}


var send = setInterval(sendRequest, interval);