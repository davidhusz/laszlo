"use strict";

class Program {
	constructor(attrs, tracks, options = {}) {
		this.attrs = attrs;
		this.tracks = tracks;
		[...this.tracks, ...this.snippets].forEach(item => {
			item.containingProgram = this;
		});
		this.firstLoad = true;
		this.chooseSnippetMode = false;
		this.chooseSnippetModeOverlay = document.querySelector("#choose-snippet-mode-overlay");
		if ("mixerContainer" in options) {
			this.mixerContainer = options.mixerContainer;
			this.updateMixer();
		}
		if ("workspaceContainer" in options) {
			this.workspaceContainer = options.workspaceContainer;
			this.updateWorkspace();
		}
		if ("infoPanelContainer" in options) {
			this.infoPanel = new InfoPanel(options.infoPanelContainer);
			this.infoPanel.containingProgram = this;
			this.infoPanel.update();
		}
		this.firstLoad = false;
	}
	
	static fromJSON(json, options = {}) {
		let { tracks, ...programAttrs } = JSON.parse(json).program;
		tracks = tracks.map(track => {
			let { snippets, ...trackAttrs } = track;
			snippets = snippets.map(snippetAttrs => {
				return new Snippet(snippetAttrs);
			});
			return new Track(trackAttrs, snippets);
		});
		return new Program(programAttrs, tracks, options);
	}
	
	toJSON() {
		return JSON.stringify(this.toObject());
	}
	
	toObject() {
		return {
			program: {
				...this.attrs,
				tracks: this.tracks.map(track => track.toObject())
			},
			version: "0.1.0"
		};
	}
	
	get snippets() {
		return this.tracks.flatMap(track => track.snippets);
	}
	
	get buttonPressPositions() {
		return this.snippets.flatMap(snippet => {
			let positions = [];
			if (JSON.stringify(snippet.attrs.start) == '{"event":"button_press"}') {
				positions.push(snippet.x);
			}
			if (JSON.stringify(snippet.dur) == '{"until":{"event":"button_press"}}') {
				positions.push(snippet.x2)
			}
			return positions;
		});
	}
	
	getSnippetById(id) {
		return this.snippets.find(snippet => snippet.attrs.id == id);
	}
	
	getTrackById(id) {
		return this.tracks.find(track => track.attrs.id == id);
	}
	
	getTrackBySnippet(snippet) {
		return this.tracks.find(track => track.snippets.includes(snippet));
	}
	
	getSelectedSnippets() {
		return this.snippets.filter(snippet => snippet.selected);
	}
	
	clearSelection() {
		this.snippets.forEach(snippet => {
			snippet.selected = false;
			snippet.indirectlySelected = false;
		});
	}
	
	generateNewId(target) {
		let items, prefix;
		if (target == "track") {
			items = this.tracks;
			prefix = "t";
		} else if (target == "snippet") {
			items = this.snippets;
			prefix = "s";
		}
		let ids = items.map(item => item.attrs.id);
		let newId = Math.max(...ids.map(id => parseInt(id.substr(1)))) + 1;
		return prefix + newId;
	}
	
	addTrack(name) {
		let id = this.generateNewId("track");
		let track = new Track({ name: name, id: id }, []);
		this.tracks.push(track);
		track.containingProgram = this;
		this.updateMixer();
		this.updateWorkspace();
	}
	
	promptForNewTrack() {
		let name = prompt("Please enter a name for the new track:", "untitled track");
		if (name !== null) {
			this.addTrack(name);
		}
	}
	
	chooseSnippet(msg, callback) {
		this.chooseSnippetMode = true;
		this.chooseSnippetModeCallback = callback;
		this.chooseSnippetModeOverlay.firstChild.innerText = msg;
		this.chooseSnippetModeOverlay.classList.add("active");
	}
	
	getBoundaryCoordinate(boundary) {
		let boundaryType = Object.keys(boundary)[0];
		switch (boundaryType) {
			case "event":
				switch (boundary.event) {
					case "boot":
						return 10;
					case "button_press":
						return null;
				}
				break;
			case "ref":
				let {id, prop} = boundary.ref;
				let snippet = this.getSnippetById(id);
				switch (prop) {
					case "start": return snippet.x;
					case "end": return snippet.x + snippet.width;
					case "dur": return snippet.width;
				}
				break;
			case "calc":
				let [calculationType, props] = Object.entries(boundary.calc)[0];
				let [prop1, prop2] = props.map(this.getBoundaryCoordinate);
				switch (calculationType) {
					case "add": return prop1 + prop2;
					case "mul": return prop1 * prop2;
				}
				break;
		}
	}
	
	addMixerHandlers() {
		this.mixerContainer.onclick = event => {
			if (event.target === this.mixerContainer.querySelector("svg")) {
				this.promptForNewTrack();
			}
		};
		// HACK: this function (in combination with the analogous one under
		// addWorkspaceHandlers) is used to synchronize vertical scrolling between
		// the mixer and the workspace. The usual event to use for this would be
		// `onscroll` event; however, if we have an `onscroll` event for both the
		// mixer and the workspace, they will effectively be always calling each
		// other in a loop, making the scrolling veeery slow in certain browser
		// engines like Gecko. As an alternative we can use the `onwheel` event,
		// which however doesn't update as instantly or as regularly or something,
		// which makes the synchronization lag sometimes. But we can use the
		// `onscroll` event on just one of the two containers, so we use it on the
		// more "important" one, the workspace.
		this.mixerContainer.onwheel = event => {
			if (this.mixerContainer.contains(event.target)) {
				this.workspaceContainer.scrollTop = this.mixerContainer.scrollTop;
			}
		};
	}
	
	addWorkspaceHandlers() {
		this.workspaceContainer.onscroll = event => {
			if (this.workspaceContainer.contains(event.target)) {
				this.mixerContainer.scrollTop = this.workspaceContainer.scrollTop;
			}
		};
	}
	
	renderMixer() {
		return `
			<svg>
				${this.tracks.map(track => track.renderMixer()).join("")}
			</svg>
		`;
	}
	
	renderWorkspace() {
		return `
			<svg>
				${this.buttonPressPositions.map(x => `
					<line class="button-press-indicator" x1="${x}px" y1="0px" x2="${x}" y2="100%"/>
				`)}
				${this.tracks.map(track => track.renderWorkspace()).join("")}
			</svg>
		`;
	}
	
	updateMixer() {
		this.mixerContainer.innerHTML = this.renderMixer();
		this.tracks.forEach(track => track.addHandlers());
		this.addMixerHandlers();
	}
	
	updateWorkspace() {
		this.workspaceContainer.innerHTML = this.renderWorkspace();
		this.snippets.forEach(snippet => snippet.setTransformOrigin());
		[...this.tracks, ...this.snippets].forEach(item => item.addHandlers());
		this.addWorkspaceHandlers();
	}
	
	updateAll() {
		this.updateMixer();
		this.updateWorkspace();
		this.infoPanel.update();
		this.addMixerHandlers();
		this.addWorkspaceHandlers();
	}
}


class Track {
	constructor(attrs, snippets) {
		this.attrs = attrs;
		this.snippets = snippets;
		this.height = 110;
		this.padding = 2.5;
		this.snippets.forEach(snippet => {
			snippet.containingTrack = this;
		});
	}
	
	toObject() {
		return {
			...this.attrs,
			snippets: this.snippets.map(snippet => snippet.toObject())
		};
	}
	
	get container() {
		return document.getElementById(this.attrs.id);
	}
	
	get index() {
		return this.containingProgram.tracks.indexOf(this);
	}
	
	get y() {
		return 5 + this.index * this.height;
	}
	
	get y2() {
		return this.y + this.height;
	}
	
	addSnippet(snippet) {
		this.snippets.push(snippet);
		snippet.containingTrack = this;
	}
	
	removeSnippet(snippet) {
		this.snippets = this.snippets.filter(elem => elem !== snippet);
	}
	
	rename() {
		let newName = prompt("Please enter a new name for this track:", this.attrs.name);
		if (newName !== null) {
			this.attrs.name = newName;
			this.containingProgram.updateMixer();
		}
	}
	
	addHandlers() {
		this.container.querySelector("text").onclick = this.rename.bind(this);
	}
	
	renderMixer() {
		return `
			<g class="track-mixer" id="${this.attrs.id}"
				opacity="${this.containingProgram.firstLoad ? 0 : 1}">
				<rect x="0" y="${this.y + this.padding}px" width="100%"
					height="${this.height - (2 * this.padding)}px" rx="5px"/>
				<text x="10px" y="${this.y + this.padding + 10}px">
					${this.attrs.name}
				</text>
				${this.containingProgram.firstLoad
					? `<animate attributeName="opacity" from="0" to="1"
							begin="${this.y/this.height/4}s" dur="0.5s" fill="freeze"/>`
					: ``
				}
			</g>
		`;
	}
	
	renderWorkspace() {
		return `
			<g class="track-workspace">
				<line class="track-separator" x1="0px" y1="${this.y2}px"
					x2="100%" y2="${this.y2}px"/>
				${this.snippets.map(snippet => snippet.renderWorkspace()).join("")}
			</g>
		`;
	}
}


class Snippet {
	constructor(attrs) {
		this.attrs = attrs;
		this.width = 200;
		this.height = 100;
		this._selected = false;
		this._indirectlySelected = false;
	}
	
	toObject() {
		return this.attrs;
	}
	
	setTransformOrigin() {
		this.container.style.transformOrigin =
			`${this.horizontalCenter}px ${this.verticalCenter}px`;
	}
	
	get container() {
		return document.getElementById(this.attrs.id);
	}
	
	get x() {
		return this.containingProgram.getBoundaryCoordinate(this.attrs.start) ?? 10;
	}
	
	get y() {
		return 10 + (this.containingTrack.index * 110);
	}
	
	get x2() {
		return this.x + this.width;
	}
	
	get y2() {
		return this.y + this.height;
	}
	
	get horizontalCenter() {
		return this.x + (this.width / 2);
	}
	
	get verticalCenter() {
		return this.y + (this.height / 2);
	}
	
	get dur() {
		if ("dur" in this.attrs) {
			return this.attrs.dur;
		} else if ("end" in this.attrs) {
			return { until: this.attrs.end };
		} else if (this.isClone) {
			return { ref:
				{
					id: this.attrs.source.ref.id,
					prop: "dur"
				}
			};
		}
	}
	
	get recording() {
		return this.clones.length > 0;
	}
	
	get clones() {
		return this.containingProgram.snippets.filter(snippet =>
			"ref" in snippet.attrs.source &&
			snippet.attrs.source.ref.id == this.attrs.id
		);
	}
	
	get isClone() {
		let sourceType = Object.keys(this.attrs.source)[0];
		return sourceType == "ref";
	}
	
	get relatives() {
		let relatives = this.clones;
		if (this.isClone) {
			let source = this.containingProgram.getSnippetById(this.attrs.source.ref.id);
			relatives.push(source);
			source.clones.forEach(clone => {
				if (clone !== this) {
					relatives.push(clone);
				}
			});
		}
		return relatives;
	}
	
	get selected() {
		return this._selected;
	}
	
	get indirectlySelected() {
		return this._indirectlySelected;
	}
	
	set selected(value) {
		if (value) {
			this.container.classList.add("selected");
			this.indirectlySelected = false;
			this.relatives.forEach(relative => {
				if (!relative.selected) {
					relative.indirectlySelected = true;
				}
			});
			this._selected = true;
		} else {
			this.container.classList.remove("selected");
			if (!this.relatives.some(relative => relative.selected)) {
				this.relatives.forEach(relative => {
					relative.indirectlySelected = false;
				});
			} else {
				this.indirectlySelected = true;
			}
			this._selected = false;
		}
		this.containingProgram.infoPanel.update();
	}
	
	set indirectlySelected(value) {
		if (value) {
			this.container.classList.add("indirectly-selected");
			this._indirectlySelected = true;
		} else {
			this.container.classList.remove("indirectly-selected");
			this._indirectlySelected = false;
		}
	}
	
	remove() {
		this.containingTrack.removeSnippet(this);
	}
	
	changeName(newName) {
		this.attrs.name = newName;
	}
	
	changeTrack(newTrack) {
		if (this.containingTrack != undefined) {
			this.containingTrack.removeSnippet(this);
		}
		newTrack.addSnippet(this);
	}
	
	changeSource(newSource) {
		this.attrs.source = newSource;
	}
	
	changeStart(newStart) {
		this.attrs.start = newStart;
	}
	
	changeDur(newDur) {
		let durType = Object.keys(newDur)[0];
		switch (durType) {
			case "ref":
				this.attrs.dur = newDur;
				break;
			case "event":
				this.attrs.end = newDur;
				delete this.attrs.dur;
		}
	}
	
	handleClick(event) {
		if (!this.containingProgram.chooseSnippetMode) {
			// hold shift while clicking for selecting multiple snippets
			if (!event.shiftKey) {
				if (!this.selected) {
					// if `this` is not yet directly selected, make it the only directly
					// selected snippet
					this.containingProgram.clearSelection();
					this.selected = true;
				} else {
					// if `this` is the only directly selected snippet, clear selection,
					// otherwise clear selection and then select `this`
					if (this.containingProgram.getSelectedSnippets().length == 1) {
						this.containingProgram.clearSelection();
					} else {
						this.containingProgram.clearSelection();
						this.selected = true;
					}
				}
			} else {
				if (!this.selected) {
					// add `this` to directly selected snippets
					this.selected = true;
				} else {
					// make `this` no longer directly selected
					this.selected = false;
				}
			}
		} else {
			this.containingProgram.chooseSnippetModeCallback(this);
			this.containingProgram.chooseSnippetMode = false;
		}
	}
	
	addHandlers() {
		this.container.onclick = this.handleClick.bind(this);
	}
	
	getCSSClasses() {
		return "snippet " +
			[[this.recording, "recording"],
			[this.isClone, "clone"],
			[this.selected, "selected"],
			[this.indirectlySelected, "indirectly-selected"]]
			.map(prop => prop[0] ? prop[1] : "")
			.join(" ");
	}
	
	renderWorkspace() {
		return `
			<g class="${this.getCSSClasses()}" id="${this.attrs.id}"
				opacity="${this.containingProgram.firstLoad ? 0 : 1}">
				<rect x="${this.x}px" y="${this.y}px"
					width="${this.width}px" height="${this.height}px" rx="5px"/>
				<text x="${this.x + 10}px" y="${this.y2 - 10}px">
					${this.attrs.name ?? ""}
				</text>
				<circle class="recording-indicator"
					cx="${this.x2 - 10}" cy="${this.y + 10}" r="5px"/>
				${this.containingProgram.firstLoad
					? `<animate attributeName="opacity" from="0" to="1"
							begin="${(this.x/this.width/8) + (this.y/this.height/7)}s"
							dur="0.5s" fill="freeze"/>`
					: ``
				}
			</g>
		`;
	}
}
