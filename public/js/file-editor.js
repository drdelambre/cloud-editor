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
	editor: null,
	browser: null,
	files: [],
	curr: -1,

	init : function(elem){
		this.element = elem;
		this.editor = new drdelambre.editor.Editor(this.element.getElementsByClassName('editor')[0]);
		drdelambre.editor.subscribe('/editor/caret', this.updateCount);

		this.editor.element.addEventListener('dragover', this.hover, false);
		this.editor.element.addEventListener('drop', this.drop, false);
		
		this.browser = new drdelambre.editor.FtpBrowser(this.element.getElementsByClassName('ftp-browser')[0]);
		
		var cursor = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('span');
		cursor[0].addEventListener('mouseup', this.openLine, false);
		cursor[1].addEventListener('mouseup', this.openChar, false);
		
		this.element.getElementsByClassName('footer')[0].getElementsByClassName('set-button')[0].addEventListener('mousedown', this.toggleSettings, false);
		var select = this.element.getElementsByClassName('footer')[0].getElementsByTagName('select')[0],
			ni = 0;
		for(var lang in drdelambre.editor.mode){
			if(lang == 'PlainText') ni = select.getElementsByTagName('option').length;
			var opt = document.createElement('option');
			opt.value = lang;
			opt.innerHTML = lang;
			select.appendChild(opt);
		}
		
		select.selectedIndex = ni;
		select.addEventListener('change', this.languageChange, false);
		
		this.element.getElementsByClassName('settings')[0].getElementsByClassName('preview')[0].addEventListener('click', this.settingsClick, false);
		var closes = this.element.getElementsByClassName('file-slider')[0].getElementsByClassName('entry'),
			closeTag = null;
		for(var ni = 0; ni < closes.length; ni++){
			closes[ni].addEventListener('mousedown', this.selectFile, false);
			closeTag = closes[ni].getElementsByTagName('span');
			if(closeTag.length) closeTag[0].addEventListener('mousedown', this.closeFile,false);
		}

		drdelambre.editor.subscribe('/editor/settings/color', this.apply);
	},
	open : function(path){
		if(path){
			for(var ni = 0; ni < this.files.length; ni++){
				if(this.files[ni].path == path){
					this.selectFile({target: this.files[ni].element});
					return;
				}
			}
		}
		var file = new drdelambre.editor.File;
		file.path = path;
		file.name = path;
		file.document = new drdelambre.editor.Document();
		this.editor.document = file.document;
		if(path){
			var ret = drdelambre.bind(function(resp){
				var mime = request.req.getResponseHeader('Content-Type').replace(/;.*/,'');
				for(var type in drdelambre.editor.mode){
					if(mime == new drdelambre.editor.mode[type]().mime)
						file.document.mode = new drdelambre.editor.mode[type]();
				}
				file.document.fromString(resp);
			}, this);
			var request = new drdelambre.ajax({
				url: path,
				success: ret
			});
		}

		this.addFile(file);
	},
	updateView : function(doc, view){
		if(!doc || doc.__inst_id__ != this.files[this.curr].document.__inst_id__)
			return;
		this.files[this.curr].view = view.start;
	},
	updateCount : function(line){
		var count = this.element.getElementsByClassName('footer')[0].getElementsByClassName('line-count')[0].getElementsByTagName('span');
		count[0].innerHTML = line.line + 1;
		count[1].innerHTML = line.char;
	},

	addFile : function(file){
		if(this.curr >= 0)
			this.files[this.curr].element.className = this.files[this.curr].element.className.replace(/\s*selected/g,'');
		this.files.push(file);
		this.curr = this.files.length - 1;

		var elem = document.createElement('div');
		elem.className = 'entry selected';
		elem.innerHTML = '<input type="hidden" value="' + this.curr + '">' + file.name + '<span>X</span>';
		file.element = elem;

		this.element.getElementsByClassName('file-slider')[0].getElementsByClassName('slide')[0].appendChild(elem);
		elem.addEventListener('mousedown', this.selectFile, false);
		elem.getElementsByTagName('span')[0].addEventListener('mousedown', this.closeFile, false);
	},
	selectFile : function(evt){
		if(evt.target.nodeName.toLowerCase() == 'span')
			return;
		if(evt.target.className.match(/open/)){
			//open file browser
			if(this.element.className.match(/edit/))
				this.slideSettings();
			this.browser.open();
			return;
		}
		if(evt.target.getElementsByTagName('input')[0].value == this.curr)
			return;

		var elem = this.element.getElementsByClassName('footer')[0].getElementsByClassName('set-button')[0];
		if(/selected/.test(elem.className)){
			elem.className = elem.className.split(/\s/).join(' ').replace(/\sselected/i,'');
			this.element.className = this.element.className.split(/\s/).join(' ').replace(/\sedit/i,'');
		}

		this.files[this.curr].element.className = this.files[this.curr].element.className.replace(/\s*selected/, '');
		this.curr = evt.target.getElementsByTagName('input')[0].value;
		this.files[this.curr].element.className += ' selected';
		this.editor.document = this.files[this.curr].document;
	},
	closeFile : function(evt){
		var id = evt.target.parentNode.getElementsByTagName('input')[0].value,
			elem = this.files[id].element;

		elem.className += ' removed';
		setTimeout(function(){ elem.parentNode.removeChild(elem); },500);

		if(id == 0 && this.files.length == 1){
			//load a new file
			console.log('not implemented yet');
			return;
		}
		
		this.files.splice(id,1);
		if(id != 0)
			this.curr--;

		this.files[this.curr].element.className = this.files[this.curr].element.className.replace(/\s*selected/, '') + ' selected';
		this.editor.document = this.files[this.curr].document;
		
		for(var ni = 0; ni < this.files.length; ni++)
			this.files[ni].element.getElementsByTagName('input')[0].value = ni;
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
		var help = this.element.getElementsByClassName('settings')[0]
				.getElementsByClassName('right')[0]
				.getElementsByClassName('help')[0],
			menu = this.element.getElementsByClassName('settings')[0]
				.getElementsByClassName('right')[0]
				.getElementsByClassName('menu');

		if(/\s+edit/.test(this.element.className)){
			this.element.className = this.element.className.split(/\s/).join(' ').replace(/\sedit/i,'');
		} else {
			if(this.element.className.match(/open/))
				this.slideSettings();
			this.element.className += ' edit';
			help.style.display = '';
			if(menu.length) menu[0].parentNode.removeChild(menu[0]);
			var prev = this.element.getElementsByClassName('settings')[0].getElementsByClassName('preview')[0];
			prev.innerHTML = this.editor.element.innerHTML;
			var lines = prev.getElementsByClassName('gutter')[0].getElementsByClassName('line');
			lines[1].parentNode.removeChild(lines[1]);
			lines[0].parentNode.removeChild(lines[0]);
			lines = prev.getElementsByClassName('content')[0].getElementsByClassName('line');
			for(var ni = 0; ni < lines.length; ni++){
				lines[ni].innerHTML = lines[ni].innerHTML.replace(new RegExp('\\s{' + drdelambre.editor.settings.tabLength + '}', 'g'), '<span class="tab">' + Array(drdelambre.editor.settings.tabLength + 1).join('&nbsp;') + '</span>');
			}
			lines[1].parentNode.removeChild(lines[1]);
			lines[0].parentNode.removeChild(lines[0]);
		}
	},
	settingsClick : function(evt){
		var help = this.element.getElementsByClassName('settings')[0]
				.getElementsByClassName('right')[0]
				.getElementsByClassName('help')[0];
		if(help.style.display != 'none')
			help.style.display = 'none';
		var elem = evt.target;
		while(elem != document.body){
			if(elem.nodeType == 1 &&
				(elem.nodeName.toLowerCase() == 'span' ||
				 elem.className == 'window' ||
				 elem.className == 'gutter' ||
				 elem.className == 'select' ||
				 elem.className == 'line-marker'))
				break;
			if(!elem.parentNode)
				elem = document.body;
			else
				elem = elem.parentNode;
		}
		
		if(elem == document.body) return;
		this.change(elem);
	},
	change : function(elem){
		var menu = this.element.getElementsByClassName('settings')[0].getElementsByClassName('menu');
		if(!menu.length){
			var men = document.createElement('div');
			men.className = 'menu';
			men.innerHTML = '<h1></h1><div class="tab" style="display:none"><div class="row"><div class="title">tab-space</div><input type="number" min="1"></div></div><div class="other"><div class="row"><div class="title">font color</div><input></div><div class="row"><div class="title">background</div><input></div></div>';
			var inps = men.getElementsByTagName('input');
			inps[0].addEventListener('input', this.setTab, false);
			inps[1].addEventListener('input', this.validateColor, false);
			inps[2].addEventListener('input', this.validateColor, false);
			this.element.getElementsByClassName('settings')[0].getElementsByClassName('right')[0].appendChild(men);
			menu = men;
		} else
			menu = menu[0];
			
		var tab = menu.getElementsByClassName('tab')[0],
			other = menu.getElementsByClassName('other')[0];

		menu.getElementsByTagName('h1')[0].innerHTML = 'Element: <span>' + elem.className + '</span>';

		if(elem.className == 'tab'){
			var inps = menu.getElementsByTagName('input');
			tab.style.display = '';
			other.style.display = 'none';

			inps[0].value = drdelambre.editor.settings.tabLength;			
			return;
		}

		tab.style.display = 'none';
		other.style.display = '';
		var inps = menu.getElementsByTagName('input'),
			style = document.defaultView.getComputedStyle(elem,null);
		inps[1].value = this.normalizeColor(style.getPropertyValue('color'));
		inps[2].value = this.normalizeColor(style.getPropertyValue('background-color'));
	},
	setTab : function(evt){
		var num = parseInt(evt.target.value);
		if(isNaN(num) || num < 1) return;
		drdelambre.editor.settings.tabLength = num;
		var menu = this.element.getElementsByClassName('settings')[0].getElementsByClassName('preview')[0].getElementsByTagName('span');
		for(var ni = 0; ni < menu.length; ni++){
			if(!menu[ni].className.match(/tab/))
				continue;
			menu[ni].innerHTML = Array(num + 1).join(' ');
		}
		this.editor.pager.updateLine(this.editor.doc, 0);
	},
	apply : function(){
		var inps = this.element
				.getElementsByClassName('settings')[0]
				.getElementsByClassName('menu')[0]
				.getElementsByTagName('input'),
			elem = this.element
				.getElementsByClassName('settings')[0]
				.getElementsByClassName('menu')[0]
				.getElementsByTagName('h1')[0]
				.getElementsByTagName('span')[0]
				.innerHTML,
			style = document.styleSheets[document.styleSheets.length - 1],
			index = style.cssRules.length,
			rule = ".editor " + (elem!='window'&&elem!='gutter'?'span':'') + "." + elem + " {";
		if(inps[1].value.length && !inps[1].className.match(/invalid/))
			rule += "color:#" + inps[1].value.replace(/#/g,'') + ';'
		if(inps[2].value.length && !inps[2].className.match(/invalid/))
			rule += "background:#" + inps[2].value.replace(/#/g,'') + ';'
		rule += "}";
		style.insertRule(rule, index);
	},
	normalizeColor : function(colorStr){
		var hex = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
		if(colorStr.match(/transparent/i) || colorStr.match(/rgba\(\s*0,\s*0,\s*0,\s*0\)/))
			return '';
		if(/rgb[a]?\((\s*\d*[,]?){3,4}\)/.test(colorStr)){
			var colors = colorStr
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
			var colors = colorStr.replace(/#/g, '').split('');
			return colors[0] + colors[0] + colors[1] + colors[1] + colors[2] + colors[2];
		} else if(!/^#?[\da-fA-F]{6}$/.test(colorStr))
			return ''
		return colorStr.replace(/#/, '');
	},
	validateColor : function(evt){
		if(!evt.target.value.length || /^#?([\da-fA-F]{3}|[\da-fA-F]{6})$/.test(evt.target.value)){
			evt.target.className = evt.target.className.replace(/\s*invalid/g,'');
			drdelambre.editor.publish('/editor/settings/color');
			return true;
		}
		if(!evt.target.className.match(/invalid/))
			evt.target.className += ' invalid';
		return false;
	},
	languageChange : function(evt){
		var lang = evt.target.options[evt.target.selectedIndex].value;
		this.editor.doc.mode = new drdelambre.editor.mode[lang]();
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
	
	slideSettings : function(){
		if(!this.element.className.match(/\s+edit/)){	// slide browser out and settings in
			this.element.className = this.element.className.replace(/\s+open/g,'');
		} else {
			this.element.className = this.element.className.replace(/\s+edit/g,'');
		}
	}
});

drdelambre.editor.File = new drdelambre.class({
	name: '',
	path: '',
	document: null,
	view: 0
});

drdelambre.editor.FtpBrowser = new drdelambre.class({
	element: null,
	
	init : function(elem){
		this.element = elem;
		
		var connect = this.element.getElementsByClassName('connected')[0].getElementsByClassName('btn')[0],
			cancel = this.element.getElementsByClassName('connector')[0].getElementsByClassName('btn-c')[0],
			setter = this.element.getElementsByClassName('connector')[0].getElementsByClassName('btn')[0],
			actions = this.element.getElementsByClassName('info')[0].getElementsByClassName('button');
		connect.addEventListener('mousedown', this.openCon, false);
		cancel.addEventListener('mousedown', this.closeCon, false);
		setter.addEventListener('mousedown', this.setCon, false);
		actions[1].addEventListener('mousedown', this.close, false);
	},

	open : function(evt){
		this.element.className += ' open';
	},
	close : function(evt){
		this.element.className = this.element.className.replace(/\s+open/g,'');
	},
	openCon : function(evt){
		this.element.className += ' connect';
	},
	closeCon : function(evt){
		this.element.className = this.element.className.replace(/\s+connect(ing)?/g,'');
	},
	setCon : function(evt){
		this.element.className += ' connecting';
		setTimeout(this.closeCon, 2000);
	}
});

drdelambre.editor.FileBrowser = new drdelambre.class({
	element: null,

	init : function(elem){
		this.element = elem;
		
	}
});