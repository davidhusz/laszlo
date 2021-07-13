"use strict";

// Global variable for development purposes
var program;

window.addEventListener("DOMContentLoaded", () => {
	let test_input = `{"program":{"title":"Woman (Oh Woman)","tracks":[{"id":"t1","name":"rhythm guitar","snippets":[{"id":"s1","name":"pre","source":{"stream":"input"},"start":{"event":"boot"},"end":{"event":"button_press"}},{"id":"s2","name":"verse guitar","source":{"stream":"input"},"start":{"ref":{"id":"s1","prop":"end"}},"end":{"event":"button_press"}},{"id":"s3","name":"chorus guitar","source":{"stream":"input"},"start":{"ref":{"id":"s2","prop":"end"}},"end":{"event":"button_press"}},{"id":"s4","source":{"ref":{"id":"s2"}},"start":{"ref":{"id":"s3","prop":"end"}}},{"id":"s5","source":{"ref":{"id":"s3"}},"start":{"ref":{"id":"s4","prop":"end"}}},{"id":"s6","name":"bridge guitar","source":{"stream":"input"},"start":{"ref":{"id":"s5","prop":"end"}},"end":{"event":"button_press"}},{"id":"s12","source":{"ref":{"id":"s3"}},"start":{"ref":{"id":"s6","prop":"end"}}}]},{"id":"t2","name":"bass","snippets":[{"id":"s7","name":"verse bass","source":{"stream":"input"},"start":{"ref":{"id":"s3","prop":"end"}},"dur":{"ref":{"id":"s2","prop":"dur"}}},{"id":"s8","name":"chorus bass","source":{"stream":"input"},"start":{"ref":{"id":"s7","prop":"end"}},"dur":{"ref":{"id":"s3","prop":"dur"}}},{"id":"s9","source":{"ref":{"id":"s8"}},"start":{"ref":{"id":"s6","prop":"end"}}}]},{"id":"t3","name":"lead guitar","snippets":[{"id":"s10","name":"chorus lead guitar","source":{"stream":"input"},"start":{"ref":{"id":"s6","prop":"end"}},"dur":{"ref":{"id":"s3","prop":"dur"}}}]}]},"version":"0.0"}`
	program = Program.fromJSON(test_input, {
		mixerContainer: document.querySelector("#mixer"),
		workspaceContainer: document.querySelector("#workspace")
	});
});


class Program {
	constructor(attrs, tracks, options = {}) {
		this.attrs = attrs;
		this.tracks = tracks;
		[...this.tracks, ...this.snippets].forEach(item => {
			item.containingProgram = this;
		});
		if ("mixerContainer" in options) {
			this.mixerContainer = options.mixerContainer;
			this.updateMixer();
		}
		if ("workspaceContainer" in options) {
			this.workspaceContainer = options.workspaceContainer;
			this.updateWorkspace();
		}
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
	
	get snippets() {
		return this.tracks.flatMap(track => track.snippets);
	}
	
	getSnippetById(id) {
		return this.snippets.find(snippet => snippet.attrs.id == id);
	}
	
	getTrackBySnippet(snippet) {
		return this.tracks.find(track => track.snippets.includes(snippet));
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
	
	calculateSnippetPositions() {
		for (let [i, track] of this.tracks.entries()) {
			for (let [j, snippet] of track.snippets.entries()) {
				snippet.x = this.getBoundaryCoordinate(snippet.attrs.start);
				if ("end" in snippet.attrs) {
					let endBoundary = this.getBoundaryCoordinate(snippet.attrs.end);
					if (endBoundary !== null) {
						snippet.width = endBoundary - snippet.x;
					}
				}
				snippet.y = 10 + (i * 110);
			}
		}
	}
	
	calculateSnippetStyles() {
		for (let snippet of this.snippets) {
			let sourceType = Object.keys(snippet.attrs.source)[0];
			switch (sourceType) {
				case "stream":
					break;
				case "ref":
					let referencedSnippet = this.getSnippetById(snippet.attrs.source.ref.id);
					referencedSnippet.recording = true;
					referencedSnippet.clones.push(snippet);
					snippet.isClone = true;
					snippet.source = referencedSnippet;
			}
		}
	}
	
	clearSelection() {
		this.snippets.forEach(snippet => snippet.unselect());
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
				${this.tracks.map(track => track.renderWorkspace()).join("")}
			</svg>
		`;
	}
	
	updateMixer() {
		this.mixerContainer.innerHTML = this.renderMixer();
		this.tracks.forEach(track => track.addHandlers());
	}
	
	updateWorkspace() {
		this.calculateSnippetPositions();
		this.calculateSnippetStyles();
		this.workspaceContainer.innerHTML = this.renderWorkspace();
		[...this.tracks, ...this.snippets].forEach(item => item.addHandlers());
	}
}


class Track {
	constructor(attrs, snippets) {
		this.attrs = attrs;
		this.snippets = snippets;
		this.height = 110;
		this.padding = 2;
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
			<g class="track-mixer" id="${this.attrs.id}">
				<rect x="0" y="${this.y + this.padding}px" width="100%"
					height="${this.height - (2 * this.padding)}px"/>
				<text x="10px" y="${this.y + this.padding + 10}px">
					${this.attrs.name}
				</text>
			</g>
		`;
	}
	
	renderWorkspace() {
		return `
			<g class="track-workspace">
				${this.snippets.join("")}
			</g>
		`;
	}
}


class Snippet {
	constructor(attrs) {
		this.attrs = attrs;
		this.width = 200;
		this.height = 100;
		this.recording = false;
		this.clones = [];
		this.isClone = false;
		// this.selected = false;
		// this.indirectlySelected = false;
	}
	
	get container() {
		return document.getElementById(this.attrs.id);
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
	
	get relatives() {
		let relatives = this.clones;
		if (this.isClone) {
			relatives.push(this.source);
			this.source.clones.forEach(clone => {
				if (clone !== this) {
					relatives.push(clone);
				}
			});
		}
		return relatives;
	}
	
	select() {
		this.container.classList.add("selected");
		this.container.classList.remove("indirectly-selected");
		this.relatives.forEach(relative => {
			if (!relative.container.classList.contains("selected")) {
				relative.container.classList.add("indirectly-selected");
			}
		});
	}
	
	unselect() {
		this.container.classList.remove("selected");
		if (!this.relatives.some(relative =>
			relative.container.classList.contains("selected")
		)) {
			this.relatives.forEach(relative => {
				relative.container.classList.remove("indirectly-selected");
			});
		} else {
			this.container.classList.add("indirectly-selected");
		}
	}
	
	rename() {
		let newName = prompt("Please enter a new name for the snippet:", this.attrs.name);
		if (newName !== null) {
			this.attrs.name = newName;
			this.container.querySelector("text").innerHTML = this.attrs.name ?? "";
		}
	}
	
	addHandlers() {
		this.container.querySelector("rect").onclick = (event) => {
			if (!event.shiftKey) {
				if (!this.container.classList.contains("selected")) {
					this.containingProgram.clearSelection();
					this.select();
				} else {
					// ideally this should clear selection if `this` is the only one selected,
					// otherwise clear selection and then select `this`
					this.containingProgram.clearSelection();
				}
			} else {
				if (!this.container.classList.contains("selected")) {
					this.select();
				} else {
					this.unselect();
				}
			}
		};
		
		this.container.querySelector("text").onclick = this.rename.bind(this);
	}
	
	getCSSClasses() {
		return "snippet " +
			[[this.recording, "recording"],
			[this.isClone, "clone"]]
			.map(prop => prop[0] ? prop[1] : "")
			.join(" ");
	}
	
	toString() {
		return `
			<g class="${this.getCSSClasses()}" id="${this.attrs.id}">
				<rect x="${this.x}px" y="${this.y}px"
					width="${this.width}px" height="${this.height}px"/>
				<text x="${this.x + 10}px" y="${this.y2 - 10}px">
					${this.attrs.name ?? ""}
				</text>
				<circle class="recording-indicator"
					cx="${this.x2 - 10}" cy="${this.y + 10}" r="5px"/>
			</g>
		`;
	}
}
