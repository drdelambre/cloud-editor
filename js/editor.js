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
		var id = ++drdelambre.inst_id;
		var fun = function(){
			if(!(this instanceof arguments.callee))
				throw new Error('drdelambre.class: not called as a constructor (try adding "new")');
			for(var member in proto){
				if(typeof proto[member] !== 'function')
					this[member] = proto[member];
				else
					this[member] = drdelambre.bind(proto[member],this);
			}
			this['__inst_id__'] = id;
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
			var req = new window.XDomainRequest();
			if(options.success)
				req.onload = function(){ options.success(req.responseText); };
			if(options.error)
				req.onerror = function(){ options.error(req.responeText); };
			
			req.open(options.method, options.url);
			req.send();
		} else {
			var req = new XMLHttpRequest();
			req.onreadystatechange = function(){
				if(req.readyState == 4){
					if(req.status == 200 && options.success)
						options.success(req.responseText);
					else if(req.status != 200 && options.error)
						options.error(req.responseText);
				}
			};
			req.open(options.method, options.url, options.async);
			req.send();
		}
	}
});

// sometimes i do crazy things with namespaces, here's the place for that
drdelambre.editor = drdelambre.editor || {
	cache: {},
	settings: {
		tabLength: 4
	},

	init : function(){},
	publish : function(topic, args){
		if(Object.prototype.toString.apply(args) !== '[object Array]')
			args = [args];
	
		var cache = drdelambre.editor.cache,
			ni, t;
		for(t in cache){
			if(topic.match(new RegExp(t)))
				for(ni = cache[t].length; ni!=0;)
					cache[t][--ni].apply(drdelambre, args || []);
		}
	},
	subscribe : function(topic, callback){
		var cache = drdelambre.editor.cache;
		topic = '^' + topic.replace(/\*/,'.*');
		if(!cache[topic])
			cache[topic] = [];
		cache[topic].push(callback);
		return [topic, callback];
	},
	unsubscribe : function(handle){
		var cache = drdelambre.editor.cache,
			t = handle[0];
		if(!cache[t]) return;
		for(var ni in cache[t])
			if(cache[t][ni] == handle[1])
				cache[t].splice(ni, 1);
	},
};

/*
 *		class:    FileEditor
 *		module:   drdelambre.editor
 *		author:   Alex Boatwright (drdelambre@gmail.com)
 *
 *		description:
 *			This class manages multiple file editors for tabbed browsing
 *			and the like so one just has to call "open/close/save" and
 *			everything involved in initializing the editor instances is
 *			taken care of.
 *
 */
drdelambre.editor.FileEditor = new drdelambre.class({
	element: null,
	editors: [],
	curr: 0,

	init : function(elem){
		this.element = elem;
		this.editors.push(new drdelambre.editor.Editor(this.element.getElementsByClassName('editor')[0]));
		drdelambre.editor.subscribe('/editor/caret', this.updateCount);

		this.editor.element.addEventListener('dragover', this.hover, false);
		this.editor.element.addEventListener('drop', this.drop, false);
		
		var cursor = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('span');
		cursor[0].addEventListener('dblclick', this.openLine, false);
		cursor[1].addEventListener('dblclick', this.openChar, false);
	},
	get editor(){
		return this.editors[this.curr];
	},
	set editor(_index){},
	updateCount : function(line){
		var count = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('span');
		count[0].innerHTML = line.line + 1;
		count[1].innerHTML = line.char;
	},
	
	openLine : function(evt){				//jFree
		var elem = evt.target,
			inp = document.createElement('input');

		while(elem != document.body){
			if(elem.nodeType == 1 && elem.nodeName.toLowerCase() == 'span')
				break;
			elem = elem.parentNode;
		}
		if(elem == document.body) return;

		inp.value = elem.innerHTML;
		elem.style.display = 'none';
		elem.parentNode.insertBefore(inp, elem);
		inp.focus();
		window.addEventListener('keypress', this.keyCloseLine, false);
		window.addEventListener('mousedown', this.closeLine, false);
	},
	keyCloseLine : function(evt){
		if(evt.which != 13) return;
		this.closeLine();
	},
	closeLine : function(evt){
		var elem = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('input')[0],
			curr = evt?evt.target:document.body;
		
		while(curr != document.body){
			if(curr == elem) break;
			curr = curr.parentNode;
		}

		if(evt && curr != document.body)
			return;
		window.removeEventListener('keypress', this.keyCloseLine, false);
		window.removeEventListener('mousedown', this.closeLine, false);
		var line = parseInt(elem.value);
		elem.nextSibling.style.display = '';
		elem.parentNode.removeChild(elem);
		if(evt || isNaN(line) || line < 1)
			return;
		if(line > this.editor.doc.lines.length)
			line = this.editor.doc.lines.length;
		this.editor.doc.cursor = {
			line: line - 1,
			char: 0
		};
	},
	openChar : function(evt){
		var elem = evt.target,
			inp = document.createElement('input');

		while(elem != document.body){
			if(elem.nodeType == 1 && elem.nodeName.toLowerCase() == 'span')
				break;
			elem = elem.parentNode;
		}
		if(elem == document.body) return;

		inp.value = elem.innerHTML;
		elem.style.display = 'none';
		elem.parentNode.insertBefore(inp, elem);
		inp.focus();
		window.addEventListener('keypress', this.keyCloseChar, false);
		window.addEventListener('mousedown', this.closeChar, false);
	},
	keyCloseChar : function(evt){
		if(evt.which != 13) return;
		this.closeChar();
	},
	closeChar : function(evt){
		var elem = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('input')[0],
			curr = evt?evt.target:document.body;
		
		while(curr != document.body){
			if(curr == elem) break;
			curr = curr.parentNode;
		}

		if(evt && curr != document.body)
			return;
		window.removeEventListener('keypress', this.keyCloseChar, false);
		window.removeEventListener('mousedown', this.closeChar, false);
		var charter = parseInt(elem.value);
		elem.nextSibling.style.display = '';
		elem.parentNode.removeChild(elem);
		if(evt || isNaN(charter) || charter < 0)
			return;
		if(charter > this.editor.doc.getLine(this.editor.doc.cursor.line||0).length)
			charter = this.editor.doc.getLine(this.editor.doc.cursor.line||0).length;
		this.editor.doc.cursor = {
			line: this.editor.doc.cursor.line||0,
			char: charter
		};
	},
	
	hover : function(evt){
		evt.stopPropagation();
		evt.preventDefault();
	},
	drop : function(evt){
		evt.stopPropagation();
		evt.preventDefault();

		var file = evt.dataTransfer.files[0];

		if(!file.name.match(/^.*\.(ttf|otf|svg|woff)$/i).length)
			return;

		var reader = new FileReader();
		reader.onload = drdelambre.bind(function(evt){
			var font = evt.target.result;
			if(!evt.objectUrl){
				var dataURL = font.split("base64");
			
				if(!~dataURL[0].indexOf("application/octet-stream")) {
					dataURL[0] = "data:application/octet-stream;base64";
					font = dataURL[0] + dataURL[1];
				}
			}
			var name = 'custom-' + file.name.replace(/\..+$/,"").replace(/\W+/g, "-");
			fontStyle = "@font-face{font-family: " + name + "; src:url(\"" + font + "\");}";
			document.styleSheets[0].insertRule(fontStyle,0);
			this.editor.element.getElementsByClassName('window')[0].style.fontFamily = name;
			this.editor.pager.resetRight();
		},this);
		reader.readAsDataURL(file);
	},
});

/*
 *		class:    Editor
 *		module:   drdelambre.editor
 *		author:   Alex Boatwright (drdelambre@gmail.com)
 *
 *		description:
 *			This class is responsible for trapping mouse data/commands
 *			for text/gutter navigation and translating pixel space into
 *			document space. Most of the file editing UI goes here.
 *
 */
drdelambre.editor.Editor = new drdelambre.class({
	element: null,
	pager: null,
	doc: null,
	cursor: null,
	textarea: null,

	hasFocus: false,
	showKeys: false,

	init : function(elem,doc){
		this.element = elem;
		if(!this.element)
			this.element = this.create();
		this.doc = doc || new drdelambre.editor.Document();
		this.pager = new drdelambre.editor.Pager(this.element.getElementsByClassName('content')[0], this.doc, this.element.getElementsByClassName('gutter')[0]);
		this.cursor = this.element.getElementsByClassName('cursor')[0];
		this.textarea = this.element.getElementsByTagName('textarea')[0];

		drdelambre.editor.subscribe('/editor/caret', this.moveCursor);
		drdelambre.editor.subscribe('/editor/scroll', this.moveCursor);
		drdelambre.editor.subscribe('/editor/selection', this.setText);

		window.addEventListener('mousedown', this.focus, false);

		if(drdelambre.isTouch){
			this.element.className += ' touch';

			this.element.getElementsByClassName('key-toggle')[0].addEventListener('click', this.toggleKeyboard, false);
			this.textarea.addEventListener('input', this.input, false);
			this.element.addEventListener('touchstart', this.startTouch, false);
			this.element.getElementsByTagName('pre')[0].addEventListener('mouseup', drdelambre.bind(function(evt){
				this.element.getElementsByTagName('pre')[0].innerHTML = '';
				if(this.showKeys) this.textarea.focus();
			},this));
			window.addEventListener('keydown', this.keydown, false);
		} else {
			this.textarea.addEventListener('input', this.input, false);
			this.element.addEventListener('mousewheel', this.pager.scroll, false);
			this.element.addEventListener('DOMMouseScroll', this.pager.scroll, false);
			this.element.addEventListener('mousedown', this.start, false);
		}
	},
	create : function(){
		var div = document.createElement('div');
		div.className = 'editor';
		div.innerHTML = '<textarea></textarea><div class="gutter"></div><div class="window"><div class="line-marker" style="display:none;"><div class="select top"></div><div class="select middle"></div><div class="select bottom"></div><div class="cursor"><div class="marker"></div><div class="tag"></div></div></div><div class="content"></div><pre contenteditable=true></pre></div><div class="key-toggle"><img src="images/keyboard.png" /> keyboard</div>';
		return div;
	},
	focus : function(evt){
		var elem = evt.target;
		while(elem != document.body){
			if(elem == this.element) break;
			if(!elem.parentNode){
				elem = document.body;
				break;
			}
			elem = elem.parentNode;
		}
		if(elem == document.body)
			elem = null;

		if(!this.hasFocus && elem){
			window.addEventListener('cut', this.cut, false);
			window.addEventListener('paste', this.paste, false);
			window.addEventListener('keydown', this.keydown, false);
			this.hasFocus = true;
		} else if(!elem){
			window.removeEventListener('cut', this.cut, false);
			window.removeEventListener('paste', this.paste, false);
			window.removeEventListener('keydown', this.keydown, false);
			this.element.getElementsByClassName('line-marker')[0].style.display = 'none';
			this.hasFocus = false;
			if(drdelambre.isTouch && this.showKeys)
				this.toggleKeyboard();
		}
	},
	toggleKeyboard : function(evt){
		if(this.showKeys){
			this.showKeys = false;
			this.element.getElementsByClassName('.key-toggle')[0].className.split(/\s/).join(' ').replace(/\w*hover/g, '');
			this.textarea.blur();
		} else {
			this.showKeys = true;
			this.element.getElementsByClassName('.key-toggle')[0].className += ' hover';
			this.textarea.focus();
		}
	},

	keydown : function(evt){
		switch(evt.which){
			case 9:			//tab
				evt.preventDefault();
				this.textarea.value = '\t';
				if(this.doc.selection.length && this.doc.selection.start.line != this.doc.selection.end.line){
					var curr = this.doc.selection.start.line,
						end = this.doc.selection.end.char == 0?this.doc.selection.end.line-1:this.doc.selection.end.line,
						state = curr > 0?this.doc.lines[curr-1]._state:null,
						text = '';
					while(curr <= end){
						text = this.doc.lines[curr].text;
						if(evt.shiftKey){
							text = /^\s/.test(text)?text.replace(new RegExp("^(\\t|\\s{" + drdelambre.editor.settings.tabLength + "}|\\s*)"), ''):text;
						} else {
							text = '\t' + text;
						}
						this.doc.lines[curr] = new drdelambre.editor.Line(text, state);
						state = this.doc.lines[curr++].format(this.doc.mode);
					}
					this.pager.updateLine(this.doc, this.doc.selection.start.line);
				} else {
					this.input({ target: this.textarea });
				}
				break;
			case 13:		//enter
				evt.preventDefault();
				var space = '',
					curr = 0,
					tab = this.doc.getLine(this.doc.cursor.line);
				while(curr < tab.length && (tab[curr] == ' ' || tab[curr] == '\t')){
					if(tab[curr++] == '\t') space += '\t';
					else space += ' ';
				}
				this.textarea.value = '\n' + space;
				this.input({ target: this.textarea });
				break;
			case 8:			//backspace
				if(!evt.shiftKey){
					if(this.doc.selection.length)
						this.doc.clearSelection();
					else
						this.doc.remove(1);
					break;
				}
			case 46:		//delete
				console.log('delete not implemented');
				break;
			case 37:		//left
			case 38:		//up
				evt.preventDefault();
				var pos = this.doc.cursor;
				if(evt.which == 37){
					if(pos.char == 0 && pos.line > 0)
						pos.char = this.doc.getLine(--pos.line).length;
					else if(pos.char > 0)
						pos.char--;
				} else {
					if(pos.line > 0){
						var len = pos.char - this.doc.getLine(--pos.line).length;
						if(len > 0) pos.char -= len;
					} else
						pos.char = 0;
				}

				var start = end = pos;
				if(evt.shiftKey){
					if(!this.doc.selection.length)
						end = this.doc.cursor;
					else if(
						start.line < this.doc.selection.start.line ||
						(start.line == this.doc.selection.start.line && start.char < this.doc.selection.start.char)
					)
						end = this.doc.selection.end;
					else
						start = this.doc.selection.start;
				}
				this.doc.selection = { start: start, end: end };
				this.doc.cursor = pos;
				break;
			case 39:		//right
			case 40:		//down
				evt.preventDefault();
				
				var len = this.doc.getLine().length,
					pos = this.doc.cursor;
				if(evt.which == 39){
					if(pos.char == len && pos.line < this.doc.lines.length - 1){
						pos.line++;
						pos.char = 0;
					} else if(pos.char < len)
						pos.char++;
				} else {
					if(pos.line == this.doc.lines.length - 1){
						pos.char = this.doc.getLine().length;
					} else {
						len = pos.char - this.doc.getLine(++pos.line).length;
						if(len > 0) pos.char -= len;
					}
				}

				var start = end = pos;
				if(evt.shiftKey){
					if(!this.doc.selection.length)
						start = this.doc.cursor;
					else if(
						end.line > this.doc.selection.end.line ||
						(end.line == this.doc.selection.end.line && end.char > this.doc.selection.end.char)
					)
						start = this.doc.selection.start;
					else
						end = this.doc.selection.end;
				}
				this.doc.selection = { start: start, end: end };
				this.doc.cursor = pos;
				break;
			default:
				return true;
		}
	},
	input : function(evt){
		this.doc.clearSelection();
		this.doc.insert(this.textarea.value);
		this.textarea.value = '';
	},
	moveCursor : function(topper){
		var marker = this.element.getElementsByClassName('line-marker')[0];
		if(	this.doc.cursor.line < this.pager.view.start - 2 ||
			this.doc.cursor.line > this.pager.view.end + 2){
			marker.style.display = 'none';
			return;
		}
		
		if(document.defaultView.getComputedStyle(marker,null).getPropertyValue('display') == 'none')
			marker.style.display = 'block';
		marker.style.top = ((this.doc.cursor.line - this.pager.view.start + 2) * this.pager.view.lineHeight - (!isNaN(topper)?topper:this.pager.element.scrollTop)) + 'px';
		
		var sels = marker.getElementsByClassName('select'),
			docsel = this.doc.selection;
		for(var ni = 0; ni < sels.length; ni++){
			sels[ni].style.width = '100%';
			sels[ni].style.top = 0;
			sels[ni].style.left = 0;
			sels[ni].style.display = 'none';
		}
		if(docsel.length){
			var line = docsel.end.line - docsel.start.line,
				start = this.pager.textToPixel(docsel.start),
				end = this.pager.textToPixel(docsel.end);

			sels[2].style.display = 'block';
			sels[2].style.left = start.left + 'px';
			sels[2].style.width = (end.left - start.left) + 'px';
			if(docsel.start.line == this.doc.cursor.line && docsel.start.char == this.doc.cursor.char){
				if(docsel.end.char == 0)
					sels[2].style.display = 'none';
				if(line > 0){
					sels[0].style.display = 'block';
					sels[0].style.top = this.pager.view.lineHeight + 'px';
					sels[0].style.width = end.left + 'px';
					sels[2].style.width = '100%';
				}
				if(line > 1){
					sels[0].style.top = (line * this.pager.view.lineHeight) + 'px';
					sels[1].style.display = 'block';
					sels[1].style.top = this.pager.view.lineHeight + 'px';
					sels[1].style.height = ((line - 1) * this.pager.view.lineHeight) + 'px';
				}
			} else {
				if(line > 0){
					sels[0].style.display = 'block';
					sels[0].style.top = (0 - this.pager.view.lineHeight) + 'px';
					sels[0].style.left = start.left + 'px';
					sels[2].style.left = 0;
					sels[2].style.width = end.left + 'px';
				}
				if(line > 1){
					sels[0].style.top = (0 - line * this.pager.view.lineHeight) + 'px';
					sels[1].style.display = 'block';
					sels[1].style.top = (0 - (line - 1) * this.pager.view.lineHeight) + 'px';
					sels[1].style.height = ((line - 1) * this.pager.view.lineHeight) + 'px';
				}
			}
		}

		var wider = document.createElement('div');
		wider.className = 'line';
		wider.innerHTML = this.doc.getLine()
				.substr(0, this.doc.cursor.char)
				.replace(/&/g,'&amp;')
				.replace(/>/g,'&gt;')
				.replace(/</g,'&lt;')
				.replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));
		wider.style.display = 'inline-block';
		this.pager.element.appendChild(wider);
		this.pager.element.style.textIndent = 0;
		var left = wider.offsetWidth + this.pager.view.left;
		if(isNaN(topper)){
			var mid = this.pager.element.offsetWidth/2;
			if(mid - left > 0){
				this.pager.view.left += mid - left;
				left = mid;
				if(this.pager.view.left > 0){
					left -= this.pager.view.left;
					this.pager.view.left = 0;
				}
			} else if(wider.offsetWidth >= mid*2){
				this.pager.view.left -= left - (mid*2);
				left = mid*2;
			}
		}
		this.pager.element.style.textIndent = this.pager.view.left + 'px';
		this.cursor.style.left = left + 'px';
		this.pager.element.removeChild(wider);
	},
	setText : function(doc){
		if(doc.__inst_id__ != this.doc.__inst_id__) return;
		this.textarea.value = this.doc.getSelection();
		this.textarea.selectionStart = 0;
		this.textarea.selectionEnd = this.textarea.value.length;
	},

	start : function(evt){
		evt.preventDefault();
		var pos = this.pager.pixelToText(evt.pageX, evt.pageY);
		this.doc.selection = {
			start: pos,
			end: pos
		};
		this.doc.cursor = pos;

		window.addEventListener('mousemove', this.move, false);
		window.addEventListener('mouseup', this.kill, false);
	},
	move : function(evt){
		evt.preventDefault();
		var pos = this.pager.pixelToText(evt.pageX, evt.pageY);
		if(this.doc.selection.length){
			if(this.doc.cursor.line == this.doc.selection.start.line && this.doc.cursor.char == this.doc.selection.start.char){
				if(pos.line > this.doc.selection.end.line || (pos.line == this.doc.selection.end.line && pos.char > this.doc.selection.end.char))
					this.doc.selection = {
						start: this.doc.selection.end,
						end: pos
					};
				else
					this.doc.selection = {
						start: pos,
						end: this.doc.selection.end
					};
			} else {
				if(pos.line > this.doc.selection.start.line || (pos.line == this.doc.selection.start.line && pos.char > this.doc.selection.start.char))
					this.doc.selection = {
						start: this.doc.selection.start,
						end: pos
					};
				else
					this.doc.selection = {
						start: pos,
						end: this.doc.selection.start
					};
			}
		}
		else {
			if(pos.line < this.doc.cursor.line || (pos.line == this.doc.cursor.line && pos.char < this.doc.cursor.char))
				this.doc.selection = {
					start: pos,
					end: this.doc.cursor
				};
			else
				this.doc.selection = {
					start: this.doc.cursor,
					end: pos
				};
		}

		this.doc.cursor = pos;
	},
	kill : function(evt){
		evt.preventDefault();
		
		window.removeEventListener('mousemove', this.move, false);
		window.removeEventListener('mouseup', this.kill, false);
	},

	startTouch : function(evt){
		var elem = evt.target;
		while(elem != document.body){
			if(elem.className && elem.className.match(/key-toggle/).length)
				return;
			elem = elem.parentNode();
		}

		var pre = this.element.getElementsByTagName('pre')[0],
			touch = evt.changedTouches[0] || evt.touches[0];
		
		pre.innerHTML = this.pager.getView()
					.replace(/&/g,'&amp;')
					.replace(/>/g,'&gt;')
					.replace(/</g,'&lt;');
		pre.style.left = this.pager.view.left + 'px',
		this.scrollIndex = {
			x: touch.pageX,
			y: touch.pageY,
			touch: touch.identifier,
			events: [],
			timer: null
		};
		
		window.addEventListener('touchmove', this.moveTouch, false);
		window.addEventListener('touchend', this.killTouch, false);
	},
	moveTouch : function(evt){
		evt.preventDefault();
		this.scrollIndex.events.push(evt.touches);

		if(this.scrollIndex.timer)
			return;
		
		var throttle = drdelambre.bind(function(){
			var cleanTouch;
			for(var ni = this.scrollIndex.events.length; ni != 0;){
				for(var no = this.scrollIndex.events[--ni].length; no!=0;){
					if(this.scrollIndex.events[ni][--no].identifier == this.scrollIndex.touch){
						cleanTouch = this.scrollIndex.events[ni][no];
						break;
					}
				}
				if(cleanTouch) break;
			}
			this.scrollIndex.events = [];
			if(!cleanTouch) return;
			this.pager.scroll({
				preventDefault:function(){},
				stopPropagation: function(){},
				wheelDeltaX:cleanTouch.pageX - this.scrollIndex.x,
				wheelDeltaY:cleanTouch.pageY - this.scrollIndex.y
			});
			this.scrollIndex.x = cleanTouch.pageX;
			this.scrollIndex.y = cleanTouch.pageY;
			this.element.getElementsByTagName('pre')[0].style.top = (0-this.pager.element.scrollTop+(2*this.pager.view.lineHeight)) + 'px';
		}, this);
		this.element.getElementsByTagName('pre')[0].innerHTML = '';
		this.scrollIndex.timer = setInterval(throttle,50);
		throttle();
	},
	killTouch : function(evt){
		window.removeEventListener('touchmove', this.moveTouch, false);
		window.removeEventListener('touchend', this.killTouch, false);
		var touch = evt.changedTouches[0];

		if(this.scrollIndex.timer)		// we moved
			clearInterval(this.scrollIndex.timer);
		else
			this.doc.cursor = this.pager.pixelToText(touch.pageX, touch.pageY);

		delete this.scrollIndex;
	},
	
	cut : function(evt){
		setTimeout(drdelambre.bind(function(){ this.doc.clearSelection(); },this),0);
	},
	paste : function(evt){
		this.textarea.value = '';
		this.textarea.focus();
		this.doc.clearSelection();
		setTimeout(drdelambre.bind(function(){
			this.doc.insert(this.textarea.value);
			this.textarea.value = '';
		},this),0);
	}
});

/*
 *		class:    Pager
 *		module:   drdelambre.editor
 *		author:   Alex Boatwright (drdelambre@gmail.com)
 *
 *		description:
 *			To help ease stress on the browser while scrolling big
 *			files, only lines that are visible are added to the dom
 *			and their HTML containers are recycled. This class
 *			manages all of that book keeping
 *
 */
drdelambre.editor.Pager = new drdelambre.class({
	element: null,
	muncher: null,
	doc: null,
	view: {
		start: 0,
		end: 0,
		lineHeight: 0,
		lineWidth: 0,
		left: 0,
		right: 0
	},
	gutter: null,

	init : function(elem, doc, gutter){
		this.element = elem;
		if(!this.element)
			throw new Error('drdelambre.editor.Pager: initialized without a container element');

		this.gutter = gutter;
		var spacer = document.createElement('div');
		spacer.className = 'line';
		this.element.appendChild(spacer);
		this.view.lineHeight = spacer.clientHeight;
		this.view.end = Math.floor(this.element.clientHeight/this.view.lineHeight) - 1;
		this.element.removeChild(spacer);
		
		this.element.innerHTML = Array(this.view.end + 6).join('<div class="line"></div>');
		this.gutter.innerHTML = Array(this.view.end + 6).join('<div class="line"></div>');
		var line = this.gutter.getElementsByClassName('line');
		for(var ni = 0; ni < line.length; ni++)
			line[ni].innerHTML = ni - 1;

		this.element.scrollTop = this.gutter.scrollTop = this.view.lineHeight * 2;

		this.muncher = document.createElement('span');
		this.muncher.className = 'muncher';
		this.muncher.style.position = 'absolute';
		this.muncher.style.top = 0;
		this.muncher.style.left = '-10000px';
		this.muncher.style.visibility = 'hidden';
		this.muncher.style.whiteSpace = 'pre';
		this.element.parentNode.insertBefore(this.muncher, this.element);

		this.doc = doc || new drdelambre.editor.Document();
		if(this.doc.loaded) this.populate(this.doc);
		drdelambre.editor.subscribe('/editor/doc/change', this.updateLine);
		drdelambre.editor.subscribe('/editor/doc/loaded', this.populate);
		drdelambre.editor.subscribe('/editor/caret', this.scrollTo);
	},
	populate : function(doc){
		this.view.end -= this.view.start;
		this.view.start = 0;
		var lines = this.element.getElementsByClassName('line'),
			guts = this.gutter.getElementsByClassName('line'),
			state = null;
			ni = 2;

		for(; ni <= this.view.end+4; ni++){
			guts[ni].innerHTML = ni - 1;
			this.doc.lines[ni-2]._state = state;
			state = this.doc.lines[ni-2].format(this.doc.mode);
			lines[ni].innerHTML = this.doc.getFormattedLine(ni-2);
		}

		this.resetRight();
	},
	updateLine : function(_doc, index){
		if(
			!_doc ||
			_doc.__inst_id__ != this.doc.__inst_id__ ||
			index < this.view.start - 2 ||
			index > this.view.end + 2
		)
			return;

		if(index == this.view.start) index -= 2;
		var start = index - this.view.start + 2
		while(index < this.view.end + 2)
			this.element.getElementsByClassName('line')[start++].innerHTML = (++index <= 0?'':this.doc.getFormattedLine(index-1));

		this.resetRight();
	},
	resetRight : function(){
		this.muncher.innerHTML = this.doc.longest
				.replace(/&/g,'&amp;')
				.replace(/</g,'&lt;')
				.replace(/>/g,'&gt;');
		this.view.lineWidth = this.muncher.offsetWidth;
		this.view.right = this.element.offsetWidth - this.view.lineWidth - 2*parseInt(document.defaultView.getComputedStyle(this.element,null).getPropertyValue('padding-left'));
	},

	pixelToText : function(pageX, pageY){
		var line = this.element.getElementsByClassName('line'),
			count = 2;
		while(count < line.length && pageY > drdelambre.getOffset(line[count]).top)
			count++;

		count = count - 3 + this.view.start;

		if(count > this.doc.lines.length - 1)
			count = this.doc.lines.length - 1
		else if(count > this.view.end)
			count = this.view.end;

		var mun = this.muncher, left = pageX - drdelambre.getOffset(line[0]).left - this.view.left,
			lstr = mstr = '', rstr = this.doc.getLine(count), mid = 0;

		mun.innerHTML = rstr.replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));
		var test = mun.offsetWidth;
		if(left > test)
			return { line: count, char: rstr.length };

		while(rstr.length){
			if(rstr.length == 1){
				mstr = rstr;
				rstr = '';
			} else {
				mid = (rstr.length/2)&~0;
				mstr = rstr.substr(0,mid);
				rstr = rstr.substr(mid);
			}

			mun.innerHTML = (lstr + mstr).replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));
			if(rstr.length){
				if(mun.offsetWidth > left)
					rstr = mstr;
				else
					lstr += mstr;
			}
		}
		return { line: count, char: lstr.length };
	},
	textToPixel : function(cursor){
		var top = (cursor.line - this.view.start) * this.view.lineHeight;
		this.muncher.innerHTML = this.doc.getLine(cursor.line)
				.replace(/&/g,'&amp;')
				.replace(/</g,'&lt;')
				.replace(/>/g,'&gt;')
				.substr(0,cursor.char)
				.replace(/\t/g, Array(drdelambre.editor.settings.tabLength + 1).join(' '));
		return {
			top: top,
			left: this.muncher.offsetWidth + this.view.left + parseInt(document.defaultView.getComputedStyle(this.element,null).getPropertyValue('padding-left'))
		};
	},

	scroll : function(e){
		e.stopPropagation();
		e.preventDefault();
		
		var x = 0, y = 0;

		if ('wheelDeltaX' in e) {
			x = e.wheelDeltaX;
			y = e.wheelDeltaY;
		} else if('detail' in e){
			if(e.axis === 2){
				y = -e.detail;
				x = 0;
			} else {
				x = -e.detail;
				y = 0;
			}
		} else {
			x = 0;
			y = e.wheelDelta;
		}
		
		var height = this.view.lineHeight * 2,
			elem = this.element,
			gut = this.gutter,
			newTop = elem.scrollTop - y;

		if(	(this.view.start == 0 && newTop < height) ||
			(this.view.end > this.doc.lines.length - 2 && newTop > height)){
			elem.scrollTop = gut.scrollTop = height;
			return;
		}

		if(newTop < 0){
			var diff = Math.round((0 - newTop)/(this.view.lineHeight*2)) + 1;
			newTop = height;
			this.moveUp(diff*2);
		} else if(newTop > height*2){
			var diff = Math.round((newTop - height*2)/(this.view.lineHeight*2)) + 1;
			newTop = height;
			if(diff > 0)
				this.moveDown(diff*2);
		}

		var newLeft = this.view.left + x;
		if(newLeft > 0)
			newLeft = 0;
		else if(newLeft < this.view.right)
			newLeft = this.view.right;
		this.view.left = newLeft;

		elem.scrollTop = gut.scrollTop = newTop;
		this.element.style.textIndent = this.view.left + 'px';
		drdelambre.editor.publish('/editor/scroll', newTop);
	},
	scrollTo : function(){
		if(this.doc.cursor.line == this.view.start){
			this.element.scrollTop = this.gutter.scrollTop = 2*this.view.lineHeight;
		} else if(this.doc.cursor.line == this.view.end){
			this.element.scrollTop = this.gutter.scrollTop = 2*this.view.lineHeight;
		}

		if(this.doc.cursor.line <= this.view.start - 1){
			this.element.scrollTop = this.gutter.scrollTop = 2*this.view.lineHeight;
			this.view.end -= this.view.start;
			var bottomHit = 0;
			if(this.doc.lines.length < this.doc.cursor.line + this.view.end)
				bottomHit = this.doc.lines.length - this.view.end - 1;
			this.view.start = bottomHit?bottomHit:this.doc.cursor.line;
			this.view.end += this.view.start;
			
			this.updateLine(this.doc, this.view.start);
			
			var gut = this.gutter.getElementsByClassName('line');
			for(var ni = 0; ni < gut.length; ni++)
				gut[ni].innerHTML = ni + this.view.start - 1;

			drdelambre.editor.publish('/editor/scroll');
		}
		else if(this.doc.cursor.line >= this.view.end + 1){
			var curr = this.view.end,
				state = this.doc.lines[curr - 1]._state;
			while(curr <= this.doc.cursor.line + 2){
				if(curr > this.doc.lines.length - 1) break;
				this.doc.lines[curr]._state = state;
				state = this.doc.lines[curr++].format(this.doc.mode);
			}
			this.element.scrollTop = this.gutter.scrollTop = 2*this.view.lineHeight;
			this.view.start -= this.view.end;
			var topHit = 0;
			if(this.doc.cursor.line + this.view.start - 1 < 0)
				topHit = 0 - this.view.start + 1;
			this.view.end = topHit?topHit:this.doc.cursor.line;
			this.view.start += this.view.end;
			
			this.updateLine(this.doc, this.view.start);
			
			var gut = this.gutter.getElementsByClassName('line');
			for(var ni = 0; ni < gut.length; ni++)
				gut[ni].innerHTML = ni + this.view.start - 1;

			drdelambre.editor.publish('/editor/scroll');
		}
	},
	getView : function(){
		var it = this.view.start,
			str = '';
		while(it <= this.view.end)
			str += this.doc.getLine(it++) + '\n';
		return str;
	},

	moveUp : function(lines){
		if(!lines)
			lines = 2;
		else if(this.view.start - lines < 0)
			lines = this.view.start;

		var elem = this.element,
			gut = this.gutter,
			start = this.view.start-2;

		for(var ni = 0; ni < lines; ni++){
			if(start - ni - 1 < 0)
				elem.lastChild.innerHTML = '';
			else
				elem.lastChild.innerHTML = this.doc.getFormattedLine(start - ni - 1);

			gut.lastChild.innerHTML = start - ni;

			elem.insertBefore(elem.lastChild, elem.firstChild);
			gut.insertBefore(gut.lastChild, gut.firstChild);
		}

		this.view.start-=lines;
		this.view.end-=lines;
	},
	moveDown : function(lines){
		if(!lines)
			lines = 2;
		else if(lines + this.view.end > this.doc.lines.length - 1)
			lines = this.doc.lines.length - 1 - this.view.end;

		var end = this.view.end + 2,
			elem = this.element,
			gut = this.gutter,
			len = this.doc.lines.length - 1,
			state = end <= len?this.doc.lines[end]._state:null;

		for(var ni = 0; ni < lines; ni++){
			if(end + ni + 1 > len)
				elem.firstChild.innerHTML = '';
			else {
				this.doc.lines[end + ni + 1]._state = state;
				state = this.doc.lines[end + ni + 1].format(this.doc.mode);
				elem.firstChild.innerHTML = this.doc.getFormattedLine(end + ni + 1);
			}

			gut.firstChild.innerHTML = end + ni + 2;

			elem.appendChild(elem.firstChild);
			gut.appendChild(gut.firstChild);
		}

		this.view.start+=lines;
		this.view.end+=lines;
	}
});

/*
 *		class:    Document
 *		module:   drdelambre.editor
 *		author:   Alex Boatwright (drdelambre@gmail.com)
 *
 *		description:
 *			The document class reads in a file from a string or HTTP
 *			request and handles the serving of lines from that file.
 *
 */
drdelambre.editor.Document = new drdelambre.class({
	loaded: false,
	lines: [],
	_mode: null,

	_cursor: {
		line: 0,
		char: 0
	},
	_selection: {
		start: {
			line: 0,
			char: 0
		},
		end: {
			line: 0,
			char: 0
		},
		length: 0
	},
	longest: '',

	init : function(mode){
		if(mode)
			this._mode = mode;
		else
			this._mode = new drdelambre.editor.mode.Javascript();
//			this._mode = new drdelambre.editor.mode.PlainText();
	},
	fromString : function(data){
		if(typeof data !== "string") return;
		var lines;
		if ("aaa".split(/a/).length == 0)
			lines = data.replace(/\r\n|\r/g, "\n").split("\n");
		else
			lines = data.split(/\r\n|\r|\n/);

		var line,
			state = null;
		for(var ni = 0; ni < lines.length; ni++){
			if(lines[ni].replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' ')).length > this.longest.length)
				this.longest = lines[ni].replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));
			line = new drdelambre.editor.Line(lines[ni]);
			this.lines.push(line);
		}
		this.loaded = true;
		drdelambre.editor.publish('/editor/doc/loaded', this);
	},
	fromURL : function(path){
		this.loaded = false;
		drdelambre.ajax({
			url: path,
			success: this.fromString
		});
	},

	insert : function(text, pos){
		if(!pos)
			pos = {
				line: this.cursor.line,
				char: this.cursor.char
			};
		else if(pos.line < 0 || pos.line > this.lines.length - 1)
			throw new Error('drdelambre.editor.Document: insert out of range\n\trequested line ' + (pos.line + 1) + ' of ' + this.lines.length);
		else if(pos.char > this.getLine(pos.line).length)
			pos.char = this.getLine(pos.line).length;

		var state = pos.line > 0?this.lines[pos.line-1]._state:null,
			before = new drdelambre.editor.Line(this.lines[pos.line].text.substr(0,pos.char), state),
			after = this.lines[pos.line].text.substr(pos.char);

		text = text.split('\n');

		var lines = [before],
			curr = 0;

		for(var ni = 0; ni < text.length-1;ni++){
			if(text[ni].replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' ')).length > this.longest.length)
				this.longest = text[ni].replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));
			lines[curr++].text += text[ni];
			state = lines[curr-1].format(this.mode);
			lines.push(new drdelambre.editor.Line('',state));
		}
		lines[curr++].text += text[ni];
		pos.char = lines[lines.length - 1].text.length;
		lines[lines.length - 1].text += after;
		lines[lines.length - 1]._state = state;
		state = lines[lines.length - 1].format(this.mode);

		if(lines[lines.length - 1].text.replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' ')).length > this.longest.length)
			this.longest = lines[lines.length - 1].text.replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));

		this.lines = this.lines.slice(0,pos.line).concat(lines).concat(this.lines.slice(pos.line+1));
		pos.line = curr = pos.line + lines.length - 1;
		while(this.lines[++curr]._state != state){
			this.lines[curr]._state = state;
			state = this.lines[curr].format(this.mode);
		}

		this.cursor = pos;

		drdelambre.editor.publish('/editor/doc/change', [this, pos.line - lines.length + 1]);
	},
	remove : function(length, pos){
		if(!pos)
			pos = {
				line: this.cursor.line,
				char: this.cursor.char
			};
		else if(pos.line < 0 || pos.line > this.lines.length - 1)
			throw new Error('drdelambre.editor.Document: insert out of range\n\trequested line ' + (pos.line + 1) + ' of ' + this.lines.length);
		else if(pos.char > this.lines[pos.line].length)
			pos.char = this.lines[pos.line].length;
			
		var line = this.lines[pos.line].text.substr(0,pos.char),
			after = this.lines[pos.line].text.substr(pos.char);
		if(length < 0){
			console.log('to did');
			return;
		}
		while(length > 0){
			if(length <= line.length){
				this.lines[pos.line].text = line.substr(0, line.length - length);
				pos.char -= length;
				break;
			}

			length -= line.length + 1;
			this.lines.splice(pos.line, 1);
			line = this.getLine(--pos.line);
			pos.char = line.length;
		}
		this.lines[pos.line].text += after;
		
		var state = pos.line > 0?this.lines[pos.line - 1]._state:null,
			curr = pos.line;
		this.lines[curr]._state = state;
		state = this.lines[curr++].format(this.mode);
		while(this.lines[curr]._state != state){
			this.lines[curr]._state = state;
			state = this.lines[curr++].format(this.mode);
		}
		this.cursor = pos;
		drdelambre.editor.publish('/editor/doc/change',[this, pos.line]);
	},
	getLine : function(index){
		if(index === 0) index = 0;
		else if(!index) index = this._cursor.line;
		else if(index < 0) throw new Error('drdelambre.editor.Document: getLine called with negative index');

		if(index >= this.lines.length) return '';
		return this.lines[index].text;
	},
	getFormattedLine : function(index){
		if(index === 0) index = 0;
		else if(!index) index = this._cursor.line;
		else if(index < 0) throw new Error('drdelambre.editor.Document: getFormattedLine called with negative index');

		if(index >= this.lines.length) return '';
		return this.lines[index].formatted;
	},

	clearSelection : function(){
		if(!this._selection.length) return;
		var pos = this._selection.start,
			posE = this._selection.end,
			len = posE.char,
			it = posE.line;

		while(it > pos.line)
			len += this.lines[--it].text.length + 1;
		len -= pos.char;

		this.remove(len, posE);
		this.selection = {
			start: pos,
			end: pos
		};
	},
	getSelection : function(){
		if(!this._selection.length) return '';
		var start = this._selection.start,
			end = this._selection.end,
			it = start.line,
			str = '',
			off = this.lines[end.line].length - end.char;
		while(it <= end.line)
			str += this.lines[it++] + '\n';
		return str.substr(0,str.length - off - 1).substr(start.char);
	},

	get cursor(){ return {line: this._cursor.line, char: this._cursor.char }; },
	set cursor(obj){
		if(	!obj ||
			!obj.hasOwnProperty('line') ||
			!obj.hasOwnProperty('char') ||
			obj.line < 0 ||
			obj.line > this.lines.length ||
			obj.char > this.getLine(obj.line).length){
			throw new Error('drdelambre.editor.Document: invalid cursor object\n\t{ line: ' + (obj.line?obj.line:'undefined') + ', char: ' + (obj.char?obj.char:'undefined') + ' }');
		}

		this._cursor.line = obj.line;
		this._cursor.char = obj.char;
		drdelambre.editor.publish('/editor/caret', this._cursor);
	},
	
	get selection(){
		return {
			start: this._selection.start,
			end: this._selection.end,
			length: this._selection.length
		}
	},
	set selection(obj){
		if(	!obj ||
			!obj.hasOwnProperty('start') ||
			!obj.start.hasOwnProperty('line') ||
			!obj.start.hasOwnProperty('char') ||
			obj.start.line < 0 ||
			obj.start.char < 0 ||
			obj.start.line > this.lines.length ||
			obj.start.char > this.getLine(obj.start.line).length	)
			throw new Error('drdelambre.editor.Document: invalid selection set');
		if(	!obj.hasOwnProperty('end') ||
			!obj.end.hasOwnProperty('line') ||
			!obj.end.hasOwnProperty('char') ||
			obj.end.line < 0 ||
			obj.end.char < 0 ||
			obj.end.line > this.lines.length ||
			obj.end.char > this.getLine(obj.end.line).length	)
			obj.end = {
				line: obj.start.line,
				char: obj.start.char
			};

		var len = 0,
			it = obj.end.line;
		if(obj.start.line == obj.end.line)
			len = obj.end.char - obj.start.char;
		else {
			len += obj.end.char;
			while(--it >= obj.start.line)
				len += this.getLine(it).length;
			len -= obj.start.char;
		}
		
		obj.length = len;

		this._selection = obj;
		drdelambre.editor.publish('/editor/selection', this);
	},
	
	get mode(){
		return this._mode;
	},
	set mode(obj){
		//trigger reformatting here
		this._mode = obj;
	}
});

/*
 *		class:    Line
 *		module:   drdelambre.editor
 *		author:   Alex Boatwright (drdelambre@gmail.com)
 *
 *		description:
 *			based on CodeMirror's lexical parser, this abstraction
 *			makes lines easier to work with
 *
 */
drdelambre.editor.Line = new drdelambre.class({	
	text : '',
	_formatted: null,
	_state:null,

	init : function(text, state){
		this.text = text;
		if(state) this._state = state;
	},
	format : function(mode){
		var pos = 0,
			text = this.text.replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' ')),
			token;
		this._formatted = '';
		while(pos < text.length){
			token = mode.token(text, pos, this._state);
			pos += token.string.length;
			token.string = token.string.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
			if(token.style)
				token.string = '<span class="' + token.style + '">' + token.string + '</span>';
			this._formatted += token.string;
			
			if(token.style == 'comment'){
				if(token.completed == true)
					this._state = null;
				else
					this._state = {
						parent: 'comment'
					};
			} else if(token.style == 'string'){
				if(token.completed == true)
					this._state = null;
				else
					this._state = {
						parent: 'string',
						character: token.character
					};
			}
		}

		return this._state;
	},
	
	get formatted(){
		if(!this._formatted)
			return this.text
				.replace(/&/g,'&amp;')
				.replace(/</g,'&lt;')
				.replace(/>/g,'&gt;')
				.replace(/\t/g,Array(drdelambre.editor.settings.tabLength + 1).join(' '));
		return this._formatted
	},
	set formatted(str){
		this._formatted = str;
	}
});

/*
 *		the following classes represent the lexemes of their respective
 *		languages. So far, only tokenizing is supported so every class should
 *		have a token() function that takes a line and the start index of that
 *		line as a parameter. The state stuff isn't finalized yet, and means
 *		different things on both sides of Line.format, but check out that
 *		function for any questions
 */
drdelambre.editor.mode = {};
drdelambre.editor.mode.Javascript = new drdelambre.class({
	operator: /[+\-*&%=<>!?|~]/,
	keywords: {
		"in": 'operator',
		"typeof": 'operator',
		"instanceof": 'operator',
		
		"true": 'atom',
		"false": 'atom',
		"null": 'atom',
		"undefined": 'atom',
		"NaN": 'atom',
		"Infinity": 'atom',
		
		"if": 'keyword',
		"while": 'keyword',
		"with": 'keyword',
		"else": 'keyword',
		"do": 'keyword',
		"try": 'keyword',
		"finally": 'keyword',
		"return": 'keyword',
		"break": 'keyword',
		"continue": 'keyword',
		"new": 'keyword',
		"delete": 'keyword',
		"throw": 'keyword',
		"var": 'keyword',
		"const": 'keyword',
		"let": 'keyword',
		"function": 'keyword',
		"catch": 'keyword',
		"for": 'keyword',
		"switch": 'keyword',
		"case": 'keyword',
		"default": 'keyword'
	},

	token : function(line, start, state){
		line = line.substr(start);
		if(state){
			if(state.parent == 'comment'){
				var str = line.match(/.*\*\//);
				if(str)
					return {
						style: 'comment',
						string: str[0],
						completed: true
					}
				return {
					style: 'comment',
					string: line,
					completed: false
				}
			}
			
			if(state.parent == 'string'){
				if(state.character == "'"){
					var str = line.match(/.*[^\\]'/);
					if(str)
						return {
							style: 'string',
							string: str[0],
							completed: true
						}
					return {
						style: 'string',
						string: line,
						completed: false,
						character: state.character
					}
				}
				
				var str = line.match(/.*[^\\]"/);
				if(str)
					return {
						style: 'string',
						string: str[0],
						completed: true
					}
				return {
					style: 'string',
					string: line,
					completed: false,
					character: state.character
				}
			}
		}

		// eat whitespace
		if(/\s/.test(line[0]))
			return {
				style: null,
				string: line.match(/\s/)[0]
			}
		if(line[0] == "'" || line[0] == '"'){
			var string = line.match(/^(["'])(?:\\\1|.)*?\1/);
			if(string)
				return {
					style: 'string',
					string: string[0],
					completed: true
				}

			return {
				style: 'string',
				string: line,
				completed: false,
				character: line[0]
			}
		}
		if(/[\[\]{}\(\),;\:\.]/.test(line[0]))
			return {
				style: null,
				string: line[0]
			}
		if(/\d/.test(line[0]))
			return {
				style: 'number',
				string: line.match(/^\d*(?:\.\d*)?(?:[eE][+\-]?\d+)?/)[0]
			}
		if(line[0] == "/"){
			if(line[1] == "/")
				return {
					style: 'comment',
					string: line,
					completed: true
				}
			if(line[1] == "*"){
				var ret = line.match(/^\/*.*\*\//);
				if(!ret)
					return {
						style: 'comment',
						string: line,
						completed: false
					}
				return {
					style: 'comment',
					string: ret[0],
					completed: true
				}
			}
			var regex = line.match(/^\/.*\/[gimy]*/);
			if(regex)
				return {
					style: 'regex',
					string: regex[0]
				}
			
			return {
				style: 'operator',
				string: line[0]
			}
		}
		if(this.operator.test(line[0]))
			return {
				style: 'operator',
				string: line[0]
			}

		var word = line.match(/^[\w\$_]+/);
		if(this.keywords[word[0]])
			return {
				style: this.keywords[word[0]],
				string: word[0]
			}
		return {
			style: null,
			string: word[0]
		}
	}
});
drdelambre.editor.mode.PlainText = new drdelambre.class({
	token : function(line, start){
		return {
			style: null,
			string: line
		};
	}
});
