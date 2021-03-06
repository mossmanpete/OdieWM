// Odie - a window manager
//
// author: Buwei Chiu <bu@hax4.in> 

var x11 = require("x11"),
	fs = require("fs"),
	path = require("path");

// odie processor
var Odie_Events = require("./events/"),
	Odie_WindowStore = require("./windowStore"),
	Odie_AtomStore = require("./atomStore");

x11.createClient(function(err, display) {
	// X client
	var X = display.client;

	Odie_AtomStore.delegate(display);
	Odie_AtomStore.scanAtoms();

	// Root window
	var root = display.screen[0].root;
	Odie_WindowStore.registerWindow(root, "ScreenRoot");

	// We make these event redirect to root
	X.ChangeWindowAttributes(root, {
		eventMask: x11.eventMask.SubstructureRedirect | x11.eventMask.SubstructureNotify | x11.eventMask.ProperityChange
	}, function(err) {
		if(err.error === 10) {
			console.log("Error: maybe another window manager had already ran?");
			process.exit(1);
		}
	});
	
	// Create a window under all windows but root (window manager window)
	var wm_root = X.AllocID();
	X.CreateWindow(wm_root, root, 0, 0, display.screen[0].pixel_width, display.screen[0].pixel_height, 0, 0, 0, 0, { backgroundPixel: 0x000000, eventMask: x11.eventMask.Exposure  | x11.eventMask.Button1Motion | x11.eventMask.ButtonPress | x11.eventMask.ButtonRelease });
	X.MapWindow(wm_root);
	Odie_WindowStore.registerWindow(wm_root, "OdieRoot");
	
	Odie_Events.setXClient(X);
	
	// TODO: grab all exising window
	//X.QueryTree()

	X.on("event", Odie_Events.Emitter);
	X.on("error", Odie_Events.Error);

	var repl = require('repl')
	var net = require('net')

	net.createServer(function (socket) {
		var r = repl.start({
			prompt: 'socket '+socket.remoteAddress+':'+socket.remotePort+'> ',
			input: socket,
			output: socket,
			terminal: true,
			useGlobal: true
		});

		r.on('exit', function () {
			socket.end()
		});

		r.context.socket = socket
		r.context.atom = Odie_AtomStore;
		r.context.window = Odie_WindowStore;
	}).listen(1337);

	fs.watch( path.join(__dirname, "events") , function(event, filename) {
		if(event == "change") {
			Odie_Events = null;

			X.removeAllListeners("event");
			X.removeAllListeners("error");

			delete require.cache[ path.join(__dirname, "events", "index.js") ];
			delete require.cache[ path.join(__dirname, "events", "mouse_actions.js") ];
			delete require.cache[ path.join(__dirname, "events", "configure_request.js") ];
			delete require.cache[ path.join(__dirname, "events", "atom_processor.js") ];

			Odie_Events = require("./events/");

			Odie_Events.setXClient(X);

			Odie_AtomStore.scanAtoms();

			X.on("event", Odie_Events.Emitter);
			X.on("error", Odie_Events.Error);

			console.log("***** Events reloaded, due to " + filename);
		}
	});
});
