var conf = {
	db: {
		db: 'cloud-editor',
		host: '127.0.0.1',
		port: 27017,
		collection: 'sessions'
	}
};
var express = require('express'),
//	MongoStore = require('connect-mongo')(express),
//    mongo = require('mongoose'),
    app = module.exports = express.createServer(),
	io = require('socket.io').listen(app);
require('./models/models.js');

app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser());
//	app.use(express.session({ secret: 'cloud-editor', key: 'connect.sid', store: new MongoStore(conf.db) }));
	app.use(express.session({ secret: 'cloud-editor', key: 'connect.sid' }));
	app.use(require('stylus').middleware({ src: __dirname + '/public' }));
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
	app.use(express.errorHandler()); 
});

// app routes
app.get('/', function(req, res){
	res.render('index', { title: 'cloud editor' });
});

var parseCookie = require('connect').utils.parseCookie,
	users = [];
io.set('authorization', function(data, accept){
	if(!data.headers.cookie)
		return accept('No cookie set',false);
	data.cookie = parseCookie(data.headers.cookie);
	data.sessionID = data.cookie['connect.sid'];
	accept(null, true);
});
io.sockets.on('connection', function(socket){
	var user = {
		session: socket.handshake.sessionID
	};
	var ni = 0;
	for(; ni < users.length; ni++){
		if(users[ni].session != socket.handshake.sessionID)
			continue;
		user = users[ni];
		break;
	}
	if(ni == users.length){
		users.push(user);
		console.log('A socket with sessionID ' + socket.handshake.sessionID 
			   + ' connected!');
	} else {
		console.log('user is already connected!');
	}
});

//var dbUrl = 'mongodb://' + conf.db.username + ':' + conf.db.password + '@' + conf.db.host + ':' + conf.db.port + '/' + conf.db.db;
//mongo.connect(dbUrl);
//mongo.connection.on('open', function(){
	app.listen(3000);
	console.log("server running on port %d in %s mode", app.address().port, app.settings.env);
//});
