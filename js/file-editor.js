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
		
		this.element.getElementsByClassName('footer')[0].getElementsByClassName('set-button')[0].addEventListener('mousedown', this.toggleSettings, false);
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
			if(!curr.parentNode){
				curr = document.body;
				break;
			}
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
	
	toggleSettings : function(evt){
		var elem = this.element.getElementsByClassName('footer')[0].getElementsByClassName('set-button')[0];
		if(/selected/.test(elem.className)){
			elem.className = elem.className.split(/\s/).join(' ').replace(/\sselected/i,'');
			this.element.className = this.element.className.split(/\s/).join(' ').replace(/\sedit/i,'');
		} else {
			elem.className += ' selected';
			this.element.className += ' edit';
		}
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

