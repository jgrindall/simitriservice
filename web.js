var express, app, port, exec, fs, mkdirp, mongoose;
var File, FileSchema, saveImage, mongoUri, maxFiles, minFiles, activate;

express = require("express");
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

app.configure(function(){
	app.use(express.static(__dirname+"/public"));
	app.use(express.bodyParser());
	mongoose.connect(mongoUri);
	app.use(express.basicAuth(function(user, pass) {
 		return user === 'symmUserName' && pass === 'symmPassword';
	}));
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
	mkdirp('./public/thumbs', function(err) { 
		if(err){
			console.log('makeThumbs error: ' + err);
			options.error(err);
			return;
		}
		else{
			fs.writeFile("./public/thumbs/thumb_"+id+".png", base64, 'base64', function(err) {
				if(err){
					console.log("writeFile "+err);
					options.error(err);
					return;
				}
				else{
					options.success();
					return;
				}
			});
		}
	});
};

app.del('/delete', function(req, res){
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
	console.log("country "+country);
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
					console.log("ok! posted");
					res.send({"success":true});
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







