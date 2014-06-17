var express, app, port, exec, fs, mkdirp, mongoose, File, FileSchema, saveImage, mongoUri;

express = require("express");
app = express();
port = Number(process.env.PORT || 5000);
exec = require('child_process').exec;
fs = require('fs');
mkdirp = require('mkdirp');
mongoose = require('mongoose');

mongoUri = process.env.MONGOLAB_URI || 'mongodb://localhost/simitriservice'; 

app.get('/', function(req, res){
	res.render("index.jade");
});


