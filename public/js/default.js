var drdelambre = drdelambre || {
	cache: {},
	debug: true,
	debugTouch: false,
	inst_id: -1,

	publish : function(topic, args){
		if(Object.prototype.toString.apply(args) !== '[object Array]')
			args = [args];
	
		var cache = drdelambre.cache,
			ni, t;
		for(t in cache){
			if(topic.match(new RegExp(t)))
				for(ni = cache[t].length; ni!=0;)
					cache[t][--ni].apply(drdelambre, args || []);
		}
	},
	subscribe : function(topic, callback){
		var cache = drdelambre.cache;
		topic = '^' + topic.replace(/\*/,'.*');
		if(!cache[topic])
			cache[topic] = [];
		cache[topic].push(callback);
		return [topic, callback];
	},
	unsubscribe : function(handle){
		var cache = drdelambre.cache,
			t = handle[0];
		if(!cache[t]) return;
		for(var ni in cache[t])
			if(cache[t][ni] == handle[1])
				cache[t].splice(ni, 1);
	},
	class : function(proto){
		var fun = function(){
			if(!(this instanceof arguments.callee))
				throw new Error('drdelambre.class: not called as a constructor (try adding "new")');
			for(var member in proto){
				if(typeof proto[member] !== 'function')
					this[member] = proto[member];
				else
					this[member] = drdelambre.bind(proto[member],this);
			}
			this['__inst_id__'] = ++drdelambre.inst_id;
			if(this.init) this.init.apply(this,arguments);
		};

		fun.prototype = proto || {};
		return fun;
	},
	extend : function() {
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0] || {},
			length = arguments.length;
	
		for(var i = 1; i < length; i++ ){
			if((options = arguments[ i ]) != null){
				for(name in options){
					src = target[ name ];
					copy = options[ name ];
	
					if(target === copy)
						continue;
	
					if(copy !== undefined)
						target[name] = copy;
				}
			}
		}
		return target;
	},
	bind : function(obj, context){
		var args = Array.prototype.slice.call(arguments, 2);
		return function(){
			return obj.apply(context, args.concat(Array.prototype.slice.call(arguments)));
		};
	}
};
drdelambre.extend(drdelambre,{
	get isTouch() {
		if(drdelambre.debugTouch)
			return true;
		return !!('ontouchend' in document) ? true : false;
	},
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
		options = drdelambre.extend({
			url: '',
			method: 'get',
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
		} else {
			this.req = new XMLHttpRequest();
			this.req.onreadystatechange = drdelambre.bind(function(){
				if(this.req.readyState == 4){
					if(this.req.status == 200 && options.success)
						options.success(this.req.responseText);
					else if(this.req.status != 200 && options.error)
						options.error(this.req.responseText);
				}
			}, this);
			this.req.open(options.method, options.url, options.async);
			this.req.send();
		}
	}
});
