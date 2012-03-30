var drdelambre = drdelambre || {
	cache: {},
	debug: true,
	debugTouch: false,
	inst_id: -1,

	publish : function(topic, args){
		if(Object.prototype.toString.apply(args) !== '[object Array]')
			args = [args];
	
		var cache = drdelambre.cache;
		for(var t in cache){
			if(topic.match(new RegExp(t)))
				$.each(cache[t], function(){
					this.apply($, args || []);
				});
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
		cache[t] && $.each(cache[t], function(idx){
			if(this == handle[1])
				cache[t].splice(idx, 1);
		});
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
					this[member] = $.proxy(proto[member],this);
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
	}
};

drdelambre.extend(drdelambre,{
	get isTouch() {
		if(drdelambre.debugTouch)
			return true;
		return !!('ontouchend' in document) ? true : false;
	}
});

// sometimes i do crazy things with namespaces, here's the place for that
drdelambre.editor = drdelambre.editor || {
	cache: {},

	init : function(){},
	publish : function(topic, args){
		if(Object.prototype.toString.apply(args) !== '[object Array]')
			args = [args];
	
		var cache = drdelambre.editor.cache;
		for(var t in cache){
			if(topic.match(new RegExp(t)))
				$.each(cache[t], function(){
					this.apply($, args || []);
				});
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
		cache[t] && $.each(cache[t], function(idx){
			if(this == handle[1])
				cache[t].splice(idx, 1);
		});
	}
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
		this.element = $(elem);
		this.editors.push(new drdelambre.editor.Editor(this.element.find('.editor')));
		drdelambre.editor.subscribe('/editor/caret', this.updateCount);
	},
	get editor(){ return this.editors[this.curr]; },
	set editor(_index){},
	updateCount : function(line){
		var count = this.element.find('.footer .line-count span');
		count.eq(0).html(line.line + 1);
		count.eq(1).html(line.char);
	}
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
	tabLen: 4,
	hasFocus: false,
	showKeys: false,

	init : function(elem,doc){
		this.element = $(elem);
		if(!this.element.length)
			this.element = this.create();
		this.doc = doc || new drdelambre.editor.Document();
		this.pager = new drdelambre.editor.Pager(this.element.find('.content'), this.doc, this.element.find('.gutter'));
		this.muncher = $('<span></span>').css({
			position: 'absolute',
			top: 0,
			left: -10000,
			visibility: 'hidden',
			margin: 0,
			padding: 0,
			'white-space':'pre',
		});
		this.element.append(this.muncher);
		this.cursor = this.element.find('.cursor');

		drdelambre.editor.subscribe('/editor/caret', this.moveCursor);
		drdelambre.editor.subscribe('/editor/scroll', this.moveCursor);
		drdelambre.editor.subscribe('/editor/selection', this.setText);

		$(window).bind('mousedown', this.focus);

		if(drdelambre.isTouch){
			this.element.addClass('touch');

			this.element.find('.key-toggle').bind('click', this.toggleKeyboard);
			this.element.children('textarea').bind('input', this.input);
			this.element.bind('touchstart', this.startTouch);
			this.element.find('pre').bind('mouseup', $.proxy(function(evt){
				this.element.find('pre').html('');
				if(this.showKeys) this.element.find('textarea').focus();
			},this));
			$(window).bind('keydown', this.keydown);
		} else {
			this.element.children('textarea').bind('input', this.input);
			this.element.bind('mousewheel DOMMouseScroll', this.pager.scroll);
			this.element.bind('mousedown', this.start);
		}
	},
	create : function(){
		return $('<div class="editor shadow"><textarea></textarea><div class="gutter"></div><div class="window"><div class="line-marker" style="display:none;"><div class="cursor blink"><div class="marker"></div></div></div><div class="content"></div></div><div class="zoom"></div></div>');
	},
	focus : function(evt){
		var elem = $(evt.target).closest(this.element);
		if(!this.hasFocus && elem.length){
			$(window).bind('cut', this.cut);
			$(window).bind('paste', this.paste);
			$(window).bind('keydown', this.keydown);
			this.hasFocus = true;
		} else if(!elem.length){
			$(window).unbind('cut', this.cut);
			$(window).unbind('paste', this.paste);
			$(window).unbind('keydown', this.keydown);
			this.element.find('.line-marker').css({ display: 'none' });
			this.hasFocus = false;
			if(drdelambre.isTouch && this.showKeys)
				this.toggleKeyboard();
		}
	},
	toggleKeyboard : function(evt){
		if(this.showKeys){
			this.showKeys = false;
			this.element.find('.key-toggle').removeClass('hover');
			this.element.find('textarea').blur();
		} else {
			this.showKeys = true;
			this.element.find('.key-toggle').addClass('hover');
			this.element.find('textarea').focus();
		}
	},

	// these two functions need to moved into the pager ////
	pixelToText : function(pageX, pageY){
		var line = this.element.find('.content .line'),
			count = 2;
		while(count < line.length && pageY > line.eq(count).offset().top){
			count++;
		}

		count = count - 3 + this.pager.view.start;

		if(count > this.doc.lines.length - 1)
			count = this.doc.lines.length - 1
		else if(count > this.pager.view.end)
			count = this.pager.view.end;

		var mun = this.muncher[0], left = pageX - line.eq(0).offset().left,
			lstr = mstr = '', rstr = this.doc.getLine(count), mid = 0;

		mun.innerHTML = Array(rstr.length + 1).join('x');
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

			mun.innerHTML = Array((lstr + mstr).length+1).join('x');
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
		var top = (cursor.line - this.pager.view.start) * this.pager.view.lineHeight;
		this.muncher[0].innerHTML = Array(cursor.char + 1).join('x');
		return {
			top: top,
			left: this.muncher[0].offsetWidth + parseInt(this.element.find('.content').css('margin-left'))
		};
	},
	////////////////////////////////////////////////////////
	keydown : function(evt){
		switch(evt.which){
			case 9:			//tab
				evt.preventDefault();
				this.input({ target: this.element.find('textarea').val('\t') });
				break;
			case 13:		//enter
				evt.preventDefault();
				var space = curr = 0;
				var tab = this.doc.getLine(this.doc.cursor.line);
				while(curr < tab.length && (tab[curr] == ' ' || tab[curr] == '\t')){
					if(tab[curr++] == '\t') space += 3;
					space += 1;
				}
				this.input({ target: this.element.find('textarea').val('\n' + Array(space+1).join(' ')) });
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
		var elem = $(evt.target);
		this.doc.insert(elem.val());
		elem.val('');
	},
	moveCursor : function(topper){
		var marker = this.element.find('.line-marker');
		if(	this.doc.cursor.line < this.pager.view.start - 2 ||
			this.doc.cursor.line > this.pager.view.end + 2){
			marker.css({ display: 'none' });
			return;
		}
		
		if(marker.css('display') == 'none')
			marker.css({ display: '' });
		marker.css({
			top: (this.doc.cursor.line - this.pager.view.start + 2) * this.pager.view.lineHeight - (!isNaN(topper)?topper:this.pager.element.scrollTop())
		});
		
		var sels = this.element.find('.line-marker .select').css({ width: '', top: '', left: '', display: 'none' }),
			docsel = this.doc.selection;
		if(docsel.length){
			var line = docsel.end.line - docsel.start.line,
				start = this.textToPixel(docsel.start),
				end = this.textToPixel(docsel.end);

			sels.eq(2).css({
				display: '',
				left: start.left,
				width: end.left - start.left
			});
			if(docsel.start.line == this.doc.cursor.line && docsel.start.char == this.doc.cursor.char){
				if(line > 0){
					sels.eq(0).css({
						display: '',
						top: this.pager.view.lineHeight,
						width: end.left
					});
					sels.eq(2).css({
						width: ''
					});
				}
				if(line > 1){
					sels.eq(0).css({
						top: line * this.pager.view.lineHeight
					});
					
					sels.eq(1).css({
						top: this.pager.view.lineHeight,
						height: (line - 1) * this.pager.view.lineHeight,
						display: ''
					});
				}
			} else {
				if(line > 0){
					sels.eq(0).css({
						display: '',
						top: 0 - this.pager.view.lineHeight,
						left: start.left
					});
					sels.eq(2).css({
						width: end.left,
						left: 0
					});
				}
				if(line > 1){
					sels.eq(0).css({
						top: 0 - line * this.pager.view.lineHeight
					});
					
					sels.eq(1).css({
						top: 0 - (line - 1) * this.pager.view.lineHeight,
						height: (line - 1) * this.pager.view.lineHeight,
						display: ''
					});
				}
			}
		} else {
			sels.css({ display: 'none' });
		}

		var wider = $('<span>' + Array(this.doc.cursor.char + 1).join('x') + '</span>');
		this.element.find('.window .content').append(wider);
		this.cursor.css({ left: wider.width() });
		wider.remove();
	},
	setText : function(doc){
		if(doc.__inst_id__ != this.doc.__inst_id__) return;
		var text = this.element.find('textarea').val(this.doc.getSelection())[0];
		text.selectionStart = 0;
		text.selectionEnd = text.value.length;
	},

	start : function(evt){
		evt.preventDefault();
		var pos = this.pixelToText(evt.pageX, evt.pageY);
		this.doc.selection = {
			start: pos,
			end: pos
		};
		this.doc.cursor = pos;

		$(window).bind('mousemove', this.move);
		$(window).bind('mouseup', this.kill);
	},
	move : function(evt){
		evt.preventDefault();
		var pos = this.pixelToText(evt.pageX, evt.pageY);
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
		
		$(window).unbind('mousemove', this.move);
		$(window).unbind('mouseup', this.kill);
	},

	startTouch : function(evt){
		if($(evt.target).closest('.key-toggle').length){
			return;
		}

		var pre = this.element.find('pre').html(this.pager.getView().replace(/&/g,'&amp;').replace(/>/g,'&gt;').replace(/</g,'&lt;')),
			touch = evt.originalEvent.changedTouches[0] || evt.originalEvent.touches[0];
		this.scrollIndex = {
			x: touch.pageX,
			y: touch.pageY,
			touch: touch.identifier,
			events: [],
			timer: null
		};
		
		$(window).bind('touchmove', this.moveTouch);
		$(window).bind('touchend', this.killTouch);
	},
	moveTouch : function(evt){
		evt.preventDefault();
		this.scrollIndex.events.push(evt.originalEvent.touches);

		if(this.scrollIndex.timer)
			return;
		
		var throttle = $.proxy(function(){
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
				originalEvent:{
					wheelDeltaX:cleanTouch.pageX - this.scrollIndex.x,
					wheelDeltaY:cleanTouch.pageY - this.scrollIndex.y
				}
			});
			this.scrollIndex.x = cleanTouch.pageX;
			this.scrollIndex.y = cleanTouch.pageY;
			this.element.find('pre').css({ top: 0-this.pager.element.scrollTop()+(2*this.pager.view.lineHeight) });
		}, this);
		this.element.find('pre').html('');
		this.scrollIndex.timer = setInterval(throttle,50);
		throttle();
	},
	killTouch : function(evt){
		$(window).unbind('touchmove', this.moveTouch);
		$(window).unbind('touchend', this.killTouch);
		var touch = evt.originalEvent.changedTouches[0];

		if(this.scrollIndex.timer)		// we moved
			clearInterval(this.scrollIndex.timer);
		else
			this.doc.cursor = this.pixelToText(touch.pageX, touch.pageY);
		delete this.scrollIndex;
	},
	
	cut : function(evt){
		setTimeout($.proxy(function(){ this.doc.clearSelection(); },this),0);
	},
	paste : function(evt){
		this.element.find('textarea').val('').focus();
		this.doc.clearSelection();
		setTimeout($.proxy(function(){
			this.doc.insert(this.element.find('textarea').val());
			this.element.find('textarea').val('');
		},this),0);
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
	fLines: [],
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
	tabLen: 4,

	init : function(){},
	fromString : function(data){
		if(typeof data !== "string") return;
		if ("aaa".split(/a/).length == 0)
			this.lines = data.replace(/\t/g,Array(this.tabLen+1).join(' ')).replace(/\r\n|\r/g, "\n").split("\n");
		else
			this.lines = data.replace(/\t/g,Array(this.tabLen+1).join(' ')).split(/\r\n|\r|\n/);
		this.fLines = Array(this.lines.length);
		this.loaded = true;
		drdelambre.editor.publish('/editor/doc/loaded', this);
	},
	fromURL : function(path){
		this.loaded = false;
		$.ajax({
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

		var line = this.lines[pos.line],
			before = line.substr(0,pos.char),
			after = line.substr(pos.char);

		text = text.replace(/\t/g,Array(this.tabLen+1).join(' ')).split('\n');

		var lines = [before],
			curr = 0;
		for(var ni = 0; ni < text.length;ni++){
			lines[curr++] += text[ni];
			lines.push('');
		}
		lines.pop();
		pos.char = lines[lines.length - 1].length;
		lines[lines.length - 1] += after;

		this.lines = this.lines.slice(0,pos.line).concat(lines).concat(this.lines.slice(pos.line+1));
		this.fLines = this.fLines.slice(0,pos.line).concat(Array(lines.length)).concat(this.fLines.slice(pos.line+1));

		pos.line = pos.line + lines.length - 1;
		this.cursor = pos;

		drdelambre.editor.publish('/editor/doc/change', [this, pos.line - lines.length + 1]);
		return;
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
			
		var line = this.lines[pos.line].substr(0,pos.char),
			after = this.lines[pos.line].substr(pos.char);
		if(length < 0){
			console.log('to did');
			return;
		}
		while(length > 0){
			if(length <= line.length){
				this.lines[pos.line] = line.substr(0, line.length - length);
				delete this.fLines[pos.line];
				pos.char -= length;
				break;
			}

			length -= line.length + 1;
			this.lines.splice(pos.line, 1);
			this.fLines.splice(pos.line, 1);
			line = this.getLine(--pos.line);
			pos.char = line.length;
		}
		this.lines[pos.line] += after;
		this.cursor = pos;
		drdelambre.editor.publish('/editor/doc/change',[this, pos.line]);
	},
	getLine : function(index){
		if(index === 0) index = 0;
		else if(!index) index = this._cursor.line;
		else if(index < 0) throw new Error('drdelambre.editor.Document: getLine called with negative index');

		if(index >= this.lines.length) return '';
		return this.lines[index];
	},
	getFormattedLine : function(index){
		if(index === 0) index = 0;
		else if(!index) index = this._cursor.line;
		else if(index < 0) throw new Error('drdelambre.editor.Document: getFormattedLine called with negative index');

		if(index >= this.lines.length) return '';
		if(!this.fLines[index])
			return this.lines[index]
				.replace(/&/g,'&amp;')
				.replace(/</g,'&lt;')
				.replace(/>/g,'&gt;');
		return this.fLines[index];
	},

	clearSelection : function(){
		if(!this._selection.length) return;
		var pos = this._selection.start,
			posE = this._selection.end,
			len = posE.char,
			it = posE.line;

		while(it > pos.line)
			len += this.lines[--it].length + 1;
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
	element : null,
	doc: null,
	view: {
		start: 0,
		end: 0,
		lineHeight: 0
	},
	gutter: null,

	init : function(elem, doc, gutter){
		this.element = $(elem);
		if(!this.element.length)
			throw new Error('drdelambre.editor.Pager: initialized without a container element');

		this.gutter = $(gutter);
		var spacer = $('<div class="line"></div>');
		this.element.append(spacer);
		this.view.lineHeight = spacer.outerHeight();
		this.view.end = Math.floor(this.element.height()/this.view.lineHeight) - 1;
		spacer.remove();
		
		this.element.html(Array(this.view.end + 6).join('<div class="line"></div>'));
		this.gutter.html(Array(this.view.end + 6).join('<div class="line"></div>')).find('.line').each(function(ni,oz){
			$(oz).html(ni-1);
		});
		this.element[0].scrollTop = this.gutter[0].scrollTop = this.view.lineHeight * 2;

		this.doc = doc || new drdelambre.editor.Document();
		if(this.doc.loaded) this.populate(this.doc);
		drdelambre.editor.subscribe('/editor/doc/change', this.updateLine);
		drdelambre.editor.subscribe('/editor/doc/loaded', this.populate);
		drdelambre.editor.subscribe('/editor/caret', this.scrollTo);
	},
	populate : function(doc){
		this.view.end -= this.view.start;
		this.view.start = 0;
		var lines = this.element.children('.line'),
			guts = this.gutter.children('.line'),
			ni = 2;

		for(; ni <= this.view.end+4; ni++){
			guts[ni].innerHTML = ni - 1;
			lines[ni].innerHTML = this.doc.getFormattedLine(ni-2);
		}
	},
	updateLine : function(_doc, index){
		if(
			_doc.__inst_id__ != this.doc.__inst_id__ ||
			index < this.view.start - 2 ||
			index > this.view.end + 2
		)
			return;

		var start = index - this.view.start + 2
		while(index < this.view.end + 2)
			this.element.find('.line').eq(start++).html(this.doc.getFormattedLine(index++));
	},
	scroll : function(evt){
		evt.stopPropagation();
		evt.preventDefault();
		
		var x = 0, y = 0,
			e = evt.originalEvent;

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
			elem = this.element[0],
			gut = this.gutter[0],
			newTop = elem.scrollTop - y;

		//don't show end cases
		if(	(this.view.start == 0 && newTop < height) ||
			(this.view.end > this.doc.lines.length - 2 && newTop > height)){
			elem.scrollTop = gut.scrollTop = height;
			return;
		}

		if(newTop < 0){
			newTop = height;
			this.moveUp();
		} else if(newTop > height * 2){
			newTop = height;
			this.moveDown();
		}

		elem.scrollTop = gut.scrollTop = newTop;
		drdelambre.editor.publish('/editor/scroll', newTop);
	},
	scrollTo : function(){
		if(this.doc.cursor.line <= this.view.start - 1){
			var diff = (this.view.start - this.doc.cursor.line) * this.view.lineHeight;
			this.scroll({
				preventDefault:function(){},
				stopPropagation: function(){},
				originalEvent:{
					wheelDeltaX:0,
					wheelDeltaY:diff
				}
			});
		} else if(this.doc.cursor.line >= this.view.end){
			var diff = (this.view.end - this.doc.cursor.line - 1) * this.view.lineHeight;
			this.scroll({
				preventDefault:function(){},
				stopPropagation: function(){},
				originalEvent:{
					wheelDeltaX:0,
					wheelDeltaY:diff
				}
			});
		} else return;
	},
	getView : function(){
		var it = this.view.start,
			str = '';
		while(it <= this.view.end)
			str += this.doc.getLine(it++) + '\n';
		return str;
	},

	moveUp : function(){
		this.view.start-=2;
		this.view.end-=2;
		var elem = this.element[0],
			gut = this.gutter[0],
			start = this.view.start;

		if(start > 1) {
			elem.lastChild.innerHTML = this.doc.getFormattedLine(start - 1);
			elem.insertBefore(elem.lastChild, elem.firstChild);
			elem.lastChild.innerHTML = this.doc.getFormattedLine(start - 2);
			elem.insertBefore(elem.lastChild, elem.firstChild);

			gut.lastChild.innerHTML = start;
			gut.insertBefore(gut.lastChild, gut.firstChild);
			gut.lastChild.innerHTML = start - 1;
			gut.insertBefore(gut.lastChild, gut.firstChild);
		} else if(start == 0){
			elem.lastChild.innerHTML = '';
			elem.insertBefore(elem.lastChild, elem.firstChild);
			elem.lastChild.innerHTML = '';
			elem.insertBefore(elem.lastChild, elem.firstChild);

			gut.lastChild.innerHTML = '';
			gut.insertBefore(gut.lastChild, gut.firstChild);
			gut.lastChild.innerHTML = '';
			gut.insertBefore(gut.lastChild, gut.firstChild);
		} else {
			elem.lastChild.innerHTML = this.doc.getFormattedLine(0);
			elem.insertBefore(elem.lastChild, elem.firstChild);

			gut.lastChild.innerHTML = 1;
			gut.insertBefore(gut.lastChild, gut.firstChild);

			this.view.start += 1;
			this.view.end += 1;
		}
	},
	moveDown : function(){
		this.view.start+=2;
		this.view.end+=2;
		var end = this.view.end,
			elem = this.element[0],
			gut = this.gutter[0],
			len = this.doc.lines.length - 1;

		if(end < len - 1){
			elem.firstChild.innerHTML = this.doc.getFormattedLine(end+1);
			elem.appendChild(elem.firstChild);
			elem.firstChild.innerHTML = this.doc.getFormattedLine(end+2);
			elem.appendChild(elem.firstChild);

			gut.firstChild.innerHTML = end+2;
			gut.appendChild(gut.firstChild);
			gut.firstChild.innerHTML = end+3;
			gut.appendChild(gut.firstChild);
		} else if(end < len){
			elem.firstChild.innerHTML = this.doc.getFormattedLine(end+1);
			elem.appendChild(elem.firstChild);

			gut.firstChild.innerHTML = end+2;
			gut.appendChild(gut.firstChild);

			this.view.start -= 1;
			this.view.end -= 1;
		} else {
			elem.firstChild.innerHTML = elem.childNodes[1].innerHTML = '';
			elem.appendChild(elem.firstChild);
			elem.appendChild(elem.firstChild);

			gut.firstChild.innerHTML = gut.childNodes[1].innerHTML = '';
			gut.appendChild(gut.firstChild);
			gut.appendChild(gut.firstChild);
		}
	}
});
