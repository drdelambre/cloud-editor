$dd.editor = $dd.editor || {
	settings: {
		tabLength: 4
	}
};

$dd.editor.Styler = $dd.object({
	element: null,
	style: null,
	sheet: null,

	init : function(elem, style){
		this.element = elem;
		this.load(style||{});
		var inp = this.element.getElementsByTagName('input')[0],
			sel = this.element.getElementsByTagName('select')[0],
			options = '';

		for(var ni in this.style)
			options += '<option value=' + ni + '>' + ni + '</option>';
		sel.innerHTML = options;
		sel.selectedIndex = 0;

		inp.value = this.style[Object.keys(this.style)[0]];
		inp.addEventListener('input',this.validateColor,false);
		sel.addEventListener('change', this.loadColor,false);
		$dd.subscribe('/editor/settings/color', this.apply);
	},
	load : function(style){
		this.style = $dd.extend(this.style||{
			background: '#272822',
			highlight: '#49483e',
			line: '#302f29',
			cursor: '#aaa',

			text: '#f8f8f2',
			gutter: '#555',
			keyword: '#66D9EF',
			comment: '#75715E',
			operator: '#F92672',
			number: '#AE81FF',
			string: '#E6DB74',
			atom: '#FD971F'
		},style);
		var rules = '', normal, fuzz;
		for(var ni in this.style){
			if(/^background$/.test(ni))
				rules += '.editor {background: ' + this.style[ni] + '} ';
			else if(/^(highlight|line|cursor)$/.test(ni))
				rules += '.editor .line-marker' + (/^highlight$/.test(ni)?' .select':'') + (/^cursor$/.test(ni)?' .marker':'') + ' {background:' + this.style[ni] + '} ';
			else if(/^text$/.test(ni)){
				rules += '.editor .window {color:' + this.style[ni] + '} ';
				rules += '.fuzz .window {color:transparent;text-shadow:0 0 3px ' + this.style[ni] + '} ';
			} else if(/^gutter$/.test(ni)){
				rules += '.editor .gutter {color:' + this.style[ni] + '} ';
				rules += '.fuzz .gutter {color:transparent;text-shadow:0 0 3px ' + this.style[ni] + '} ';
			} else {
				rules += '.editor span.' + ni + ' {color:' + this.style[ni] + '} ';
				rules += '.fuzz span.' + ni + ' {color:transparent;text-shadow:0 0 3px ' + this.style[ni] + '} ';
			}
		}
		if(this.sheet)
			this.sheet.parentNode.removeChild(this.sheet);
		this.sheet = document.createElement('style');
		this.sheet.innerHTML = rules;
		document.body.appendChild(this.sheet);
	},
	apply : function(){
		var inp = this.element.getElementsByTagName('input')[0],
			sel = this.element.getElementsByTagName('select')[0],
			prop = {};
		prop[sel.options[sel.selectedIndex].value] = inp.value;
		this.load(prop);
	},
	loadColor : function(){
		var inp = this.element.getElementsByTagName('input')[0],
			sel = this.element.getElementsByTagName('select')[0];
		inp.value = this.style[sel.options[sel.selectedIndex].value];
	},
	normalizeColor : function(colorStr){
		var hex = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'], colors;
		if(colorStr.match(/transparent/i) || colorStr.match(/rgba\(\s*0,\s*0,\s*0,\s*0\)/))
			return '';
		if(/rgb[a]?\((\s*\d*[,]?){3,4}\)/.test(colorStr)){
			colors = colorStr
					.replace(/^rgb[a]?\(/, '')
					.replace(/\)\s*$/, '')
					.replace(/\s*,\s*/g, ',')
					.split(','),
					f = l = '0';
			return	hex[(colors[0]/16)&~0] + hex[colors[0]%16] +
					hex[(colors[1]/16)&~0] + hex[colors[1]%16] +
					hex[(colors[2]/16)&~0] + hex[colors[2]%16];
		}
		if(/^#?[\da-fA-F]{3,3}$/.test(colorStr)){
			colors = colorStr.replace(/#/g, '').split('');
			return colors[0] + colors[0] + colors[1] + colors[1] + colors[2] + colors[2];
		} else if(!/^#?[\da-fA-F]{6}$/.test(colorStr))
			return '';
		return colorStr.replace(/#/, '');
	},
	validateColor : function(evt){
		if(!evt.target.value.length || /^#?([\da-fA-F]{3}|[\da-fA-F]{6})$/.test(evt.target.value)){
			evt.target.className = evt.target.className.replace(/\s*invalid/g,'');
			$dd.publish('/editor/settings/color');
			return true;
		}
		if(!evt.target.className.match(/invalid/))
			evt.target.className += ' invalid';
		return false;
	}
});

/*
 *		class:    FileEditor
 *		module:   $dd.editor
 *		author:   Alex Boatwright ($dd@gmail.com)
 *
 *		description:
 *			This class manages multiple file editors for tabbed browsing
 *			and the like so one just has to call "open/close/save" and
 *			everything involved in initializing the editor instances is
 *			taken care of.
 *
 */
$dd.editor.FileEditor = $dd.object({
	element: null,
	slider: null,
	editor: null,
	browser: null,
	style: null,

	init : function(elem){
		this.element = elem;
		this.editor = new $dd.editor.Editor(this.element.getElementsByClassName('editor')[0]);
		$dd.subscribe('/editor/caret', this.updateCount);

		this.editor.element.addEventListener('dragover', this.hover, false);
		this.editor.element.addEventListener('drop', this.drop, false);

		this.browser = new $dd.editor.FileBrowser(this.element.getElementsByClassName('file-browser')[0]);
		this.slider = new $dd.editor.FileSlider(this.element.getElementsByClassName('file-slider')[0]);
		
		var cursor = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('span');
		cursor[0].addEventListener('mouseup', this.openLine, false);
		cursor[1].addEventListener('mouseup', this.openChar, false);

		this.element.getElementsByClassName('footer')[0].getElementsByClassName('set-button')[0].addEventListener('mousedown', this.toggleSettings, false);
		var select = this.element.getElementsByClassName('footer')[0].getElementsByTagName('select')[0],
			ni = 0;
		for(var lang in $dd.editor.mode){
			if(lang == 'PlainText') ni = select.getElementsByTagName('option').length;
			var opt = document.createElement('option');
			opt.value = lang;
			opt.innerHTML = lang;
			select.appendChild(opt);
		}
		
		select.selectedIndex = ni;
		select.addEventListener('change', this.languageChange, false);

		this.style = new $dd.editor.Styler(this.element.getElementsByClassName('settings')[0].getElementsByClassName('menu')[0]);

		$dd.subscribe('/editor/file/select', this.loadFile);
		$dd.subscribe('/editor/file/open', this.showBrowser);
	},
	open : function(path){
		var file = new $dd.editor.File();
		file.path = path;
		file.name = path;
		file.document = new $dd.editor.Document();
		this.editor.document = file.document;
		if(path){
			var ret = function(resp){
				var mime = request.req.getResponseHeader('Content-Type').replace(/;.*/,'');
				for(var type in $dd.editor.mode){
					if(mime == new $dd.editor.mode[type]().mime)
						file.document.mode = new $dd.editor.mode[type]();
				}
				file.document.fromString(resp);
			}.bind(this);
			var request = new $dd.ajax({
				url: path,
				success: ret
			});
		}

		this.slider.add(file);
	},
	loadFile : function(file){
		this.element.className = this.element.className.replace(/\s+edit/g,'');
		this.editor.document = file.document;
	},
	loadStyle : function(style){ this.style.load(style); },
	showBrowser : function(){
		this.element.className = this.element.className.replace(/\s+edit/g,'');
	},
	updateCount : function(line){
		var count = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('span');
		count[0].innerHTML = line.line + 1;
		count[1].innerHTML = line.char;
	},

	openLine : function(evt){
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
			if(!curr.parentNode) curr = document.body;
			else curr = curr.parentNode;
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
			if(!curr.parentNode) curr = document.body;
			else curr = curr.parentNode;
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
	
	toggleSettings : function(evt){
		if(/\s+edit/.test(this.element.className)){
			this.browser.close();
			this.element.className = this.element.className.split(/\s/).join(' ').replace(/\s(fuzz|edit)/gi,'');
		} else {
			this.element.className = this.element.className.split(/\s/).join(' ').replace(/\s(fuzz|edit)/gi,'') + ' fuzz edit';
		}
	},
	languageChange : function(evt){
		var lang = evt.target.options[evt.target.selectedIndex].value;
		this.editor.doc.mode = new $dd.editor.mode[lang]();
		this.editor.pager.updateLine(this.editor.doc, 0);
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
		reader.onload = function(evt){
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
		}.bind(this);
		reader.readAsDataURL(file);
	},
});

$dd.editor.File = new $dd.object({
	name: '',
	path: '',
	document: null,
	view: 0
});

$dd.editor.FileSlider = new $dd.object({
	element: null,
	files: [], curr: -1,

	mover: null, spacer: null, evts: null, timer: null, left:null,
	

	init : function(elem){
		this.files = [];
		this.element = elem;
		this.element.getElementsByClassName('open')[0].addEventListener('mousedown', this.start, false);
	},
	add : function(file){
		if(this.curr >= 0)
			this.files[this.curr].element.className = this.files[this.curr].element.className.replace(/\s*selected/g,'');
		this.files.push(file);
		this.curr = this.files.length - 1;

		var elem = document.createElement('div');
		elem.className = 'entry selected';
		elem.innerHTML = '<input type="hidden" value="' + this.curr + '">' + file.name + '<span>X</span>';
		file.element = elem;

		this.element.getElementsByClassName('slide')[0].appendChild(elem);
		elem.addEventListener('mousedown', this.start, false);
		elem.getElementsByTagName('span')[0].addEventListener('mousedown', this.remove, false);
	},
	select : function(evt){
		if(evt.target.nodeName.toLowerCase() == 'span')
			return;
		if(evt.target.className.match(/\s+selected/))
			return
		if(evt.target.className.match(/open/)){
			$dd.publish('/editor/file/open');
			return;
		}

		this.files[this.curr].element.className = this.files[this.curr].element.className.replace(/\s*selected/, '');
		this.curr = evt.target.getElementsByTagName('input')[0].value;
		this.files[this.curr].element.className += ' selected';
		$dd.publish('/editor/file/select', this.files[this.curr]);
	},
	remove : function(evt){
		var id = evt.target.parentNode.getElementsByTagName('input')[0].value,
			elem = this.files[id].element;

		elem.className += ' removed';
		setTimeout(function(){ elem.parentNode.removeChild(elem); },500);

		if(id == 0 && this.files.length == 1){
			$dd.publish('/editor/file/open');
			return;
		}
		
		this.files.splice(id,1);
		if(id != 0)
			this.curr--;

		if(elem.className.match(/\s+selected/)){
			this.files[this.curr].element.className = this.files[this.curr].element.className.replace(/\s*selected/, '') + ' selected';
			$dd.publish('/editor/file/select', this.files[this.curr]);
		}
		
		for(var ni = 0; ni < this.files.length; ni++)
			this.files[ni].element.getElementsByTagName('input')[0].value = ni;
	},
	
	start : function(evt){
		if((evt.target.nodeName||'').toLowerCase() == 'span')
			return;
		this.mover = evt;
		this.evts = [];
		if(!evt.target.className.match(/open/))
			window.addEventListener('mousemove', this.move, false);
		window.addEventListener('mouseup', this.kill, false);
	},
	move : function(evt){
		this.evts = evt;
		evt.preventDefault();
		if(this.timer) return;
		this.left = evt.pageX - $dd.getOffset(this.mover.target).left + $dd.getOffset(this.mover.target.parentNode).left;
		this.mover.target.className += ' moving';
		this.mover.target.style.left = ($dd.getOffset(this.mover.target).left - $dd.getOffset(this.mover.target.parentNode).left) + 'px';
		this.spacer = document.createElement('div');
		this.spacer.className = 'entry spacer';
		this.spacer.innerHTML = 'who\sagoodspacer?';
		this.spacer.style.height = '2px';
		this.spacer.style.width = this.mover.target.offsetWidth + 'px';
		this.mover.target.parentNode.insertBefore(this.spacer, this.mover.target);
		var throttle = function(){
			if(!this.evts) return;
			var left = this.evts.pageX - this.left;
			this.mover.target.style.left = left + 'px';
			this.evts = null;
		}.bind(this);
		this.timer = setInterval(throttle, 100);
		throttle();
	},
	kill : function(evt){
		window.removeEventListener('mousemove', this.move, false);
		window.removeEventListener('mouseup', this.kill, false);

		if(!this.timer){	// just a click
			this.select(this.mover);
			return;
		}

				
		clearInterval(this.timer);
		this.mover.target.className += ' closing';
		this.mover.target.style.left = this.spacer.offsetLeft + 'px';
		setTimeout((function(obj,spacer){ return function(){
			obj.className = obj.className.replace(/(\s+closing|\s+moving)/g,'');
			spacer.parentNode.removeChild(spacer);
		}; })(this.mover.target, this.spacer), 200);
		this.timer = this.mover = this.spacer = this.left = this.evts = null;
	}
});

$dd.editor.FileBrowser = new $dd.object({
	element: null,
	pane: null,
	currPane: 0,
	socket: null,

	init : function(elem){
		this.element = elem;
		this.pane = [];	//the folder stack
		
		this.element.addEventListener('drop', this.drop, false);
		var actions = this.element.getElementsByClassName('login')[0].getElementsByClassName('button');
		actions[2].addEventListener('mousedown', this.close, false);

		$dd.subscribe('/editor/file/open', this.open);
		
		this.socket = io.connect('/');
		this.socket.on('path', function(data){
			console.log(data);
		});
	},

	open : function(evt){
		this.element.className += ' open';
	},
	close : function(evt){
		this.element.className = this.element.className.replace(/\s+open/g,'');
	},
	drop : function(evt){
	}
});

$dd.editor.FilePane = new $dd.object({
	element: null,
	selected: false,
	entries: null,
	
	init : function(elem){
		this.element = elem;
		this.entries = [];
	},
	load : function(json){
		var elem;
		for(var ni = 0, ents = json.entries, len = ents.length; ni < len; ni++){
			elem = document.createElement('div');
			elem.className = 'entry ' + ents[ni].type;
			elem.addEventListener('mousedown', (function(index){
				return function(){
					this.open(index);
				}.bind(this);
			})(ni), false);
			elem.innerHTML = ents[ni].name;
			this.element.appendChild(elem);
			this.entries.push({
				element: elem,
				type: ents[ni].type,
				path: json.path + ents[ni].name
			});
		}
		elem = document.createElement('div');
		elem.className = 'entry new';
		elem.addEventListener('mousedown', this.add, false);
		elem.innerHTML = '<span>+</span>new';
		this.element.appendChild(elem);
	},
	add : function(evt){},
	open : function(index){
		var sel = this.entries[this.selected].element;
		sel.className = sel.className.replace(/\s+selected/g,'');
		if(index == this.selected){
			$dd.publish('/editor/file/deselect', this);
			return;
		}
		this.entries[index].element.className += ' selected';
		this.selected = index;
		$dd.publish('/editor/file/select/' + (this.entries[index].type == 'folder'?'folder':'file'), this);
	}
});
