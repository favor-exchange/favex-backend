var express = require('express');
var app = express();

var parser = require('body-parser');
var routes = require('./routes');

app.use(parser.urlencoded({extended: true}));
app.use(parser.json());

var port = 80;

app.use('/', routes);
const server= app.listen(port);
server.timeout= 240000;
console.log('Listening on local host port: ' + port);
