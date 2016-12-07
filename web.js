var express, app, port, exec, fs, mkdirp, mongoose, nodemailer, smtpTransport;
var File, FileSchema, saveImage, mongoUri, maxFiles, minFiles, activate, AWS, s3Explorer;

express = require("express");
nodemailer = require("nodemailer");
AWS = require('aws-sdk');
s3Explorer = new AWS.S3();

smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: "simitriapp@gmail.com",
        pass: "simitrielperro2!"
    }
});

app = express();
port = Number(process.env.PORT || 5000);
exec = require('child_process').exec;
fs = require('fs');
mkdirp = require('mkdirp');
mongoose = require('mongoose');
maxFiles = 20;
minFiles = 2;
mongoUri = process.env.MONGOLAB_URI || 'mongodb://localhost/simitriservice';

FileSchema = new mongoose.Schema({
	"country"		:	{"type":String},
	"latitude"		:	{"type":Number},
	"drawerNum"		:	{"type":Number},
	"longitude"		:	{"type":Number},
	"active"		:	{"type":Boolean, default:false},
	"modified"		:	{"type":Date, default:Date.now}
});

File = mongoose.model("File", FileSchema);

var countActiveFiles = function(options){
	console.log("count active");
	File.find({"active":true}).count(function(err, count){
		if(err){
			console.log("err "+err);
			options.fail();
		}
		else{
			options.success(count);
		}
	});
};

var sendEmailToMe = function(_id, options){
	var text = "Review: " + _id;
	var mailOptions = {
		from: "simitriapp@gmail.com",
		to: "simitriapp@gmail.com",
		subject: "File submitted to Simitri gallery",
		text: text
	};
	if(smtpTransport){
		smtpTransport.sendMail(mailOptions, function(error, response){
			if(error){
				options.error(error);
			}
			else{
				options.success();
			}
			smtpTransport.close();
		});
	}
};

var bodyParser = require('body-parser');

app.use(express.static(__dirname+"/public"));
app.use(bodyParser());

app.use(function(req, res, next) {
    var auth;
    if (req.headers.authorization) {
      auth = new Buffer(req.headers.authorization.substring(6), 'base64').toString().split(':');
    }
    if (!auth || auth[0] !== 'symmUserName' || auth[1] !== 'symmPassword') {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="symm"');
        res.end('Unauthorized');
    }
    else {
        next();
    }
});

mongoose.connect(mongoUri, function(err, res){
	console.log ('result ', err, res);
	if (err) {
	    console.log ('ERROR connecting to: ' + mongoUri + '. ' + err);
	  }
	  else {
	    console.log ('Succeeded connected to: ' + mongoUri);
	  }
});


app.get('/', function(req, res){
	res.render("index.jade");
});

app.get('/list', function(req, res){
	var sort = {"modified":-1};
	File.find().skip(0).sort(sort).exec(function(err, doc){
		if(err){
			res.send(400);
			return;
		}
		else{
			res.send({"success":true, "files":doc});
			return;
		}
	});
});

app.get('/files', function(req, res){
	countActiveFiles({
		"success":function(count){
			console.log("count active = "+count);
			var sort = {"modified":-1};
			var loop = false;
			var numLoaded = req.param("numLoaded", 0);
			if(numLoaded > count - minFiles){
				loop = true;
				numLoaded = 0;
			}
			console.log("numLoaded " + numLoaded+"  loop " + loop);
			File.find({"active":true}).skip(numLoaded).limit(maxFiles).sort(sort).exec(function(err, doc){
				console.log("found "+err+" "+doc);
				if(err){
					res.send(400);
					return;
				}
				else{
					res.send({"success":true, "files":doc, "loop":loop});
					return;
				}
			});
		},
		"fail":function(){
			console.log("count fail");
			res.send(400);
			return;
		}
	});
});

saveImage = function(id, base64, options){
	var rnd = Math.floor(Math.random()*1000);
	var body = new Buffer(base64, 'base64');
	var params = {
		Bucket: 'com.jgrindall.simitrithumbs',
		Key: 'thumb_'+id+'.png',
		Body: body
	};
	s3Explorer.putObject(params, function (error, response) {
		if (error) {
			console.log("aws error "+error);
			options.error("Error uploading data: " + error);
		}
		else {
			console.log("aws ok");
			options.success();
		}
	});
};

app.delete('/delete', function(req, res){
	var _id = req.param("_id", null);
	console.log("deleting "+_id);
	File.findById(_id, function (err, file) {
    	file.remove(function (err) {
      		if (err) {
        		console.log("error removing");
        		res.send(400);
				return;
      		}
      		else {
        		res.send({"success":"true"});
      		}
    	});
  	});
});

app.post('/activate', function(req, res){
	var _id = req.param("_id", null);
	var activate = req.param("activate", false);
	File.update({"_id":_id}, {"active":activate}, function(err, doc){
		if(err){
			console.log('activate file error: ' + err);
			res.send(400);
			return;
		}
		else if(doc){
			console.log("ok! activated set to "+activate + " for " + doc);
			res.send({"success":"true"});
		}
		else{
			res.send(400);
			return;
		}
	});
});

app.post('/files', function(req, res){
	console.log("posting...");
	var country, latitude, longitude, description, imgData, drawerNum;
	country = req.param("country", null);
	latitude = req.param("latitude", null);
	drawerNum = req.param("drawerNum", null);
	longitude = req.param("longitude", null);
	imgData = req.param("imgData", null);
	model = {"country": country, "longitude": longitude, "drawerNum": drawerNum, "active":false, "latitude":latitude, "modified":new Date()};
	new File(model).save(function(err, doc){
		if(err){
			console.log('make file error: ' + err);
			res.send(400);
			return;
		}
		else{
			console.log("posted with "+doc._id);
			saveImage(doc.id, imgData, {
				"success":function(){
					console.log("ok! posted, sending email");
					sendEmailToMe(doc._id, {
						"success":function(){
							res.send({"success":true});
						},
						"error":function(error){
							console.log("error "+error);
							res.send({"success":true});
						}
					});
				},
				"error":function(err){
					res.send(400);
				}
			});
		}
	});
});

app.listen(port, function(){
  console.log("Listening on " + port);
});







