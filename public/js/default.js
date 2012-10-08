/**************bind polyfill from mozilla *************/
if(!Function.prototype.bind){
	Function.prototype.bind = function(oThis){
		if(typeof this !== "function") {
			// closest thing possible to the ECMAScript 5 internal IsCallable function
			throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
		}

		var aArgs = Array.prototype.slice.call(arguments, 1),
			fToBind = this,
			fNOP = function(){},
			fBound = function(){
				return fToBind.apply(this instanceof fNOP && oThis?this:oThis,
							aArgs.concat(Array.prototype.slice.call(arguments)));
			};
	
		fNOP.prototype = this.prototype;
		fBound.prototype = new fNOP();
	
		return fBound;
	};
}


var $dd = $dd || {
	inst_id: -1,

	object : function(proto){
		var fun = function(){
			if(!(this instanceof arguments.callee))
				throw new Error('$dd.object: not called as a constructor (try adding "new")');
			var defs = {},
				beans;
			for(var member in proto){
				if(typeof proto[member] !== 'function'){
					this[member] = proto[member];
					continue;
				}
				this[member] = proto[member].bind(this);

				if(/^_[gs]et/.test(member)){
					beans = member.slice(4);
					if(!defs[beans]) defs[beans] = {};
					defs[beans][(/^_get/.test(member)?'get':'set')] = this[member];
				}
			}
			for(var ni in defs)
				Object.defineProperty(this,ni,defs[ni]);

			this['__inst_id__'] = ++$dd.inst_id;
			if(this.init) this.init.apply(this,arguments);
		};

		fun.prototype = proto || {};
		return fun;
	},
	extend : function() {
		var options, name, src, copy,
			target = arguments[0],
			length = arguments.length;
	
		for(var i = 1; i < length; i++ ){
			if((options = arguments[i]) !== null){
				for(name in options){
					if(options[name] !== undefined)
						target[name] = options[name];
				}
			}
		}
		return target;
	}
};

//PUBSUB
$dd.extend($dd,{
	cache: {},
	publish : function(){
		var cache = $dd.cache,
			topic = arguments[0],
			args = Array.prototype.slice.call(arguments, 1)||[],
			ni, t;

		for(t in cache){
			if(topic.match(new RegExp(t))){
				for(ni = 0; ni < cache[t].length; ni++){
					cache[t][ni].apply($dd, args);
				}
			}
		}
	},
	subscribe : function(topic, callback){
		var cache = $dd.cache;
		topic = '^' + topic.replace(/\*/,'.*');
		if(!cache[topic])
			cache[topic] = [];
		cache[topic].push(callback);
		return [topic, callback];
	},
	unsubscribe : function(handle){
		var cache = $dd.cache,
			t = handle[0];
		if(!cache[t]) return;
		for(var ni in cache[t])
			if(cache[t][ni] == handle[1])
				cache[t].splice(ni, 1);
	}
});
/***************************************************************************\
							PUBSUB DOCUMENTATION
						cause it's easy to get lost

	/editor/caret
	/editor/settings/color
	/editor/file/open
	/editor/file/select
	/editor/file/deselect

	/editor/caret
	/editor/scroll
	/editor/selection
	/editor/doc/loaded
	/editor/doc/change

\***************************************************************************/

//INPUT
$dd.extend($dd,{
	input: $dd.input || {},
	get isTouch(){
		return !!('ontouchend' in document);
	}
});
$dd.input.Touch = $dd.object({
	touches: null,
	throttle: null,
	options: null,

	init : function(options){
		this.options = $dd.extend({
			element: window,
			start: null,
			move: null,
			end: null
		}, options);

		if(!$dd.isTouch)
			this.options.element.addEventListener('mousedown', this.start, false);
		else
			this.options.element.addEventListener('touchstart', this.start, false);

		this.touches = {};
	},
	start : function(evt){
		evt.preventDefault();
		var touch, count = Object.keys(this.touches||{}).length;
		if($dd.isTouch){
			for(var ni = 0; ni < evt.changedTouches.length; ni++){
				touch = evt.changedTouches[ni];
				if(this.touches[touch.identifier]) return;
				this.touches[touch.identifier] = touch;
				if(!this.options.start) continue;
				this.options.start({
					id: touch.identifier,
					target: touch.target,
					pageX: touch.pageX,
					pageY: touch.pageY
				});
			}
		} else {
			this.touches[0] = evt;
			if(this.options.start)
				this.options.start({
					id: 0,
					target: evt.target,
					pageX: evt.pageX,
					pageY: evt.pageY
				});
		}

		if(count === 0 && $dd.isTouch){
			window.addEventListener('touchmove', this.move, false);
			window.addEventListener('touchend', this.end, false);
			window.addEventListener('touchcancel', this.end, false);
			this.evts = {};
		} else if(!$dd.isTouch){
			window.addEventListener('mousemove', this.move, false);
			window.addEventListener('mouseup', this.end, false);
		}
	},
	move : function(evt){
		evt.preventDefault();
		if(!$dd.isTouch){
			this.evts = [evt];
		} else {
			for(var ni = 0; ni < evt.touches.length; ni++){
				if(!this.touches[evt.touches[ni].identifier]) continue;
				this.touches[evt.touches[ni].identifier] = evt.touches[ni];
				this.evts[evt.touches[ni].identifier] = evt.touches[ni];
			}
		}

		if(this.throttle)
			return;

		var t = function(){
			var elem;
			for(var no in this.touches){
				if(!this.evts[no]) continue;
				if(this.options.move)
					this.options.move({
						id: no,
						target: this.evts[no].target,
						pageX: this.evts[no].pageX,
						pageY: this.evts[no].pageY
					});
			}
			this.evts = {};
		}.bind(this);

		this.throttle = setInterval(t,50);
		t();
	},
	end : function(evt){
		var touch, elem;
		if(!$dd.isTouch){
			if(this.options.end)
				this.options.end({ id: 0, target: evt.target });
			delete this.touches[0];
		} else {
			for(var ni = 0; ni < evt.changedTouches.length; ni++){
				touch = evt.changedTouches[ni];
				if(!this.touches[touch.identifier]) return;
				if(this.options.end)
					this.options.end({ id: touch.identifier, target: touch.target });
				delete this.touches[touch.identifier];
			}
		}

		if(!Object.keys(this.touches).length){
			if($dd.isTouch){
				window.removeEventListener('touchmove', this.move, false);
				window.removeEventListener('touchend', this.end, false);
				window.removeEventListener('touchcancel', this.end, false);
			} else {
				window.removeEventListener('mousemove', this.move, false);
				window.removeEventListener('mouseup', this.end, false);
			}
			this.touches = {};
			this.evts = {};
			if(this.throttle){
				clearInterval(this.throttle);
				this.throttle = null;
			}
		}
	},
	remove : function(){
		if(!$dd.isTouch){
			this.options.element.removeEventListener('mousedown', this.start, false);
			window.removeEventListener('mousemove', this.move, false);
			window.removeEventListener('mouseup', this.end, false);
			return;
		}

		this.options.element.removeEventListener('touchstart', this.start, false);
		window.removeEventListener('touchmove', this.move, false);
		window.removeEventListener('touchend', this.end, false);
		window.removeEventListener('touchcancel', this.end, false);
	}
});

//UI
$dd.extend($dd,{
	ui: $dd.ui||{},
	getOffset : function(elem){
		var box = elem.getBoundingClientRect();
		if(!box)
			return { top: 0, left: 0 };
	
		var body = elem.ownerDocument.body,
			clientTop  = document.documentElement.clientTop  || body.clientTop  || 0,
			clientLeft = document.documentElement.clientLeft || body.clientLeft || 0,
			scrollTop  = window.pageYOffset || document.documentElement.scrollTop  || body.scrollTop,
			scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || body.scrollLeft,
			top  = box.top  + scrollTop  - clientTop,
			left = box.left + scrollLeft - clientLeft;
	
		return { top: top, left: left };
	},
	ajax : function(options){
		options = $dd.extend({
			url: '',
			method: 'get',
			data: null,
			type: 'application/x-www-form-urlencoded',
			success: null,
			error: null,
			async: true
		}, options);
	
		if(window.XDomainRequest){
			this.req = new window.XDomainRequest();
			if(options.success)
				this.req.onload = function(){ options.success(this.req.responseText); };
			if(options.error)
				this.req.onerror = function(){ options.error(this.req.responeText); };
			
			this.req.open(options.method, options.url);
			this.req.send();
			return;
		}
		this.req = new XMLHttpRequest();
		this.req.onreadystatechange = function(){
			if(this.req.readyState == 4){
				if(this.req.status == 200 && options.success)
					options.success(this.req.responseText);
				else if(this.req.status != 200 && options.error)
					options.error(this.req.responseText);
			}
		}.bind(this);
		if(options.method == 'get'){
			this.req.open('GET', options.url + (options.data?'?'+data:''), options.async);
			this.req.send();
		} else {
			this.req.open('POST', options.url, options.async);
			this.req.setRequestHeader("Content-type", options.type);
			this.req.send(options.data);
		}
	}
});
