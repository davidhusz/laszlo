"use strict";

class InfoPanel {
	constructor(container) {
		this.container = container;
		this._newSnippet = null;
	}
	
	get table() {
		return this.container.querySelector(".snippet-info table");
	}
	
	get masterButtons() {
		return this.container.querySelector(".master-buttons");
	}
	
	get addSnippetArea() {
		return this.container.querySelector(".add-snippet-area");
	}
	
	get snippetInfo() {
		return this.container.querySelector(".snippet-info");
	}
	
	get selectionCount() {
		return this.container.querySelector(".selection-count");
	}
	
	get selectedSnippets() {
		return this.containingProgram.getSelectedSnippets();
	}
	
	get currentSnippet() {
		if (!this.isAddingNewSnippet()) {
			if (this.selectedSnippets.length == 1) {
				return this.selectedSnippets[0];
			} else if (this.selectedSnippets.length == 0) {
				console.error("No snippet selected");
			} else {
				console.error("More than one snippet selected");
			}
		} else {
			return this._newSnippet;
		}
	}
	
	get currentTrack() {
		return this.currentSnippet.containingTrack;
	}
	
	hasOneSnippet() {
		return this.selectedSnippets.length == 1 || this.isAddingNewSnippet();
	}
	
	hasStartedEditing() {
		if (this.table !== null) {
			return this.table.querySelectorAll(".started-editing").length > 0;
		} else {
			return false;
		}
	}
	
	isCurrentSnippetModified() {
		if (this.table !== null) {
			return Array.from(this.table.querySelectorAll(".info")).some(propInfo =>
				"modifiedValue" in propInfo.dataset
			);
		} else {
			return false;
		}
	}
	
	isAddingNewSnippet() {
		return this._newSnippet !== null;
	}
	
	editName() {
		this.editProperty(
			"name",
			originalValue => `<input type="text" value="${originalValue ?? "unnamed snippet"}">`
		);
	}
	
	editTrack() {
		this.editProperty(
			"track",
			originalValue =>
				`
					<select>
						${this.containingProgram.tracks.map(track => `
							<option value="${track.attrs.id}"
									${track.attrs.id == originalValue ? "selected" : ""}>
								${track.attrs.name}
							</option>
						`).join("")}
						<option value="new">new track...</option>
					</select>
				`,
				(editor, trackInfo) => {
					if (editor.value != "new") {
						trackInfo.modifiedValue = editor.value;
					} else {
						this.containingProgram.promptForNewTrack();
						let allTracks = this.containingProgram.tracks;
						let newTrack = allTracks[allTracks.length-1];
						let newValue = newTrack.attrs.id;
						let newOption = document.createElement("option");
						newOption.setAttribute("value", newValue)
						newOption.innerHTML = newTrack.attrs.name;
						editor.appendChild(newOption);
						editor.value = newValue;
						trackInfo.modifiedValue = newValue;
					}
				}
		);
	}
	
	editSource() {
		let _ = this.serializeForHTMLAttribute;
		this.editProperty(
			"source",
			originalValueAsJSON => {
				let originalValue, sourceType;
				if (originalValueAsJSON !== undefined) {
					originalValue = JSON.parse(originalValueAsJSON);
					sourceType = Object.keys(originalValue)[0];
				} else {
					originalValue = undefined;
					sourceType = undefined;
				}
				let editor = `<select>`;
				if (sourceType == "ref") {
					editor += `
						<option value="${_(originalValue)}" selected>
							${this.getPropertyInfoText(originalValue)}
						</option>`;
				}
				editor += `
						<option value="${_({stream: "input"})}"
							${sourceType == "stream" ? "selected" : ""}>live input</option>
						<option value="clone">clone another snippet...</option>
						<option value="file">from file...</option>
					</select>
				`;
				return editor;
			},
			(editor, sourceInfo) => {
				if (editor.value == JSON.stringify({stream: "input"})) {
					sourceInfo.modifiedValue = editor.value;
				} else if (editor.value == "clone") {
					this.containingProgram.chooseSnippet("please click on the snippet you want to clone", newSource => {
						this.containingProgram.chooseSnippetModeOverlay.classList.remove("active");
						
						if (newSource.attrs.id == this.currentSnippet.attrs.id) {
							this.showModificationError("a snippet cannot be a clone of itself");
							return;
						} else if (newSource.x2 > this.currentSnippet.x) {
							this.showModificationError("a cloned snippet must come after the snippet that it is a clone of");
							return;
						}
						
						let newValue = {
							ref: { id: newSource.attrs.id }
						};
						let newOption = document.createElement("option");
						newOption.setAttribute("value", _(newValue));
						newOption.innerHTML = this.getPropertyInfoText(newValue);
						editor.appendChild(newOption);
						editor.value = _(newValue);
						sourceInfo.modifiedValue = JSON.stringify(newValue);
						// since this a delayed callback, we have to render again
						this.updateMasterButtons();
						this.updateSelectionCount();
					});
				}
			}
		);
	}
	
	editStart() {
		let _ = this.serializeForHTMLAttribute;
		this.editProperty(
			"start",
			originalValueAsJSON => {
				let originalValue, startType;
				if (originalValueAsJSON !== undefined) {
					originalValue = JSON.parse(originalValueAsJSON);
					startType = Object.keys(originalValue)[0];
				} else {
					originalValue = undefined;
					startType = undefined;
				}
				let editor = `<select>`;
				if (startType == "ref") {
					editor += `
						<option value="${_(originalValueAsJSON)}" selected>
							${this.getPropertyInfoText(originalValue)}
						</option>
					`;
				}
				let events = [{ event: "boot" }, { event: "button_press" }];
				for (let event of events) {
					editor += `
						<option value="${_(event)}" ${event == originalValue ? "selected" : ""}>
							${event.event.replace("_", " ")} event
						</option>
					`;
				}
				editor += `
						<option value="ref-start">start of another snippet...</option>
						<option value="ref-end">end of another snippet...</option>
					</select>
				`;
				return editor;
			},
			(editor, startInfo) => {
				if (editor.value == "ref-start" || editor.value == "ref-end") {
					this.containingProgram.chooseSnippet("please click on the snippet you want to derive this snippet's start from", newStart => {
						this.containingProgram.chooseSnippetModeOverlay.classList.remove("active");
						
						let followRefs = ref => {
							// Make sure we're not getting stuck in an infinite loop
							if (Object.keys(ref.attrs.start)[0] == "ref") {
								let refId = ref.attrs.start.ref.id;
								if (refId == this.currentSnippet.attrs.id) {
									this.showModificationError(
										"your selection results in an infinite loop (two or " +
										"more snippets have their start events pointing at each other)"
									);
									return;
								} else {
									followRefs(this.containingProgram.getSnippetById(refId));
								}
							}
						}
						followRefs(newStart);
						
						let newValue = {
							ref: {
								id: newStart.attrs.id,
								prop: editor.value.replace("ref-", "")
							}
						};
						let newOption = document.createElement("option");
						newOption.setAttribute("value", _(newValue));
						newOption.innerHTML = this.getPropertyInfoText(newValue);
						editor.appendChild(newOption);
						editor.value = _(newValue);
						startInfo.modifiedValue = JSON.stringify(newValue);
						// since this a delayed callback, we have to render again
						this.updateMasterButtons();
						this.updateSelectionCount();
					});
				} else if (Object.keys(JSON.parse(editor.value))[0] == "event") {
					startInfo.modifiedValue = editor.value;
				}
			}
		);
	}
	
	editDur() {
		let _ = this.serializeForHTMLAttribute;
		this.editProperty(
			"dur",
			originalValueAsJSON => {
				let originalValue, durType;
				if (originalValueAsJSON !== undefined) {
					originalValue = JSON.parse(originalValueAsJSON);
					durType = Object.keys(originalValue)[0];
				} else {
					originalValue = undefined;
					durType = undefined;
				}
				let editor = `<select>;`
				if (durType == "ref") {
					editor += `
						<option value="${_(originalValueAsJSON)}" selected>
							${this.getPropertyInfoText(originalValue)}
						</option>
					`;
				}
				let events = [{ event: "button_press" }];
				for (let event of events) {
					editor += `
						<option value="${_(event)}" ${event == originalValue ? "selected" : ""}>
							until next ${event.event.replace("_", " ")} event
						</option>
					`;
				}
				editor += `
						<option value="ref-dur">duration of another snippet...</option>
					</select>
				`;
				return editor;
			},
			(editor, durInfo) => {
				if (editor.value == "ref-dur") {
					this.containingProgram.chooseSnippet("please click on the snippet you want to derive this snippet's duration from", newDur => {
						this.containingProgram.chooseSnippetModeOverlay.classList.remove("active");
						if (newDur.attrs.id == this.currentSnippet.attrs.id) {
							this.showModificationError("a snippet cannot have its duration be a reference to its own duration (infinite recursion)");
							return;
						} else if (newDur.x2 > this.currentSnippet.x) {
							this.showModificationError("a snippet deriving its duration from another snippet must come after the referenced snippet");
							return;
						}
						let newValue = {
							ref: {
								id: newDur.attrs.id,
								prop: "dur"
							}
						};
						let newOption = document.createElement("option");
						newOption.setAttribute("value", _(newValue));
						newOption.innerHTML = this.getPropertyInfoText(newValue);
						editor.appendChild(newOption);
						editor.value = _(newValue);
						durInfo.modifiedValue = JSON.stringify(newValue);
						// since this a delayed callback, we have to render again
						this.updateMasterButtons();
						this.updateSelectionCount();
					});
				} else if (Object.keys(JSON.parse(editor.value))[0] == "event") {
					durInfo.modifiedValue = editor.value;
				}
			}
		);
	}
	
	editProperty(propName, editorCreator, inputHandler = null) {
		let propInfo = this.table.querySelector(`.${propName}.info`);
		if (!propInfo.classList.contains("started-editing")) {
			let originalValue = propInfo.dataset.originalValue;
			if (originalValue == "undefined") {
				originalValue = undefined;
			}
			propInfo.innerHTML = editorCreator(originalValue);
			propInfo.classList.add("started-editing");
			let editor = propInfo.children[0];
			if (editor.tagName == "INPUT") {
				editor.select();
			}
			if (originalValue == undefined) {
				propInfo.dataset.modifiedValue = editor.value;
			}
			this.updateMasterButtons();
			editor.oninput = () => {
				if (editor.value !== originalValue) {
					if (inputHandler !== null) {
						inputHandler(editor, propInfo.dataset);
					} else {
						propInfo.dataset.modifiedValue = editor.value;
					}
				} else {
					delete propInfo.dataset.modifiedValue;
				}
				this.updateMasterButtons();
				this.updateSelectionCount();
			}
		}
	}
	
	showModificationError(msg) {
		alert(`Error: ${msg}. Please try again`);
		this.cancelModifications();
	}
	
	saveModifications() {
		for (let prop of this.table.querySelectorAll(".info")) {
			let propInfo = prop.dataset;
			if (propInfo.modifiedValue !== undefined &&
				propInfo.modifiedValue != propInfo.originalValue) {
					switch (prop.classList[1]) {
						case "name":
							this.currentSnippet.changeName(propInfo.modifiedValue);
							break;
						case "source":
							this.currentSnippet.changeSource(JSON.parse(propInfo.modifiedValue));
							break;
						case "start":
							this.currentSnippet.changeStart(JSON.parse(propInfo.modifiedValue));
							break;
						case "dur":
							this.currentSnippet.changeDur(JSON.parse(propInfo.modifiedValue));
							break;
						case "track":
							let newTrack = this.containingProgram.getTrackById(propInfo.modifiedValue);
							this.currentSnippet.changeTrack(newTrack);
							break;
					}
			}
		}
		this.containingProgram.updateAll();
		this.containingProgram.clearSelection();
	}
	
	saveNewSnippet() {
		this.saveModifications();
		this._newSnippet.selected = true;
		this._newSnippet = null;
		this.updateSelectionCount();
	}
	
	cancelModifications() {
		this.table.querySelectorAll(".info").forEach(propInfo => {
			// exit edit mode
			propInfo.classList.remove("started-editing");
			// discard all modifications
			delete propInfo.dataset.modifiedValue;
		});
		// remove newly added snippet if present
		this._newSnippet = null;
		this.update();
	}
	
	deleteSelectedSnippets() {
		let question;
		let snippetCount = this.selectedSnippets.length;
		if (snippetCount == 1) {
			question = `Delete snippet "${this.currentSnippet.attrs.name}"?`;
		} else {
			question = `Delete ${snippetCount} snippets?`;
		}
		if (confirm(question)) {
			this.selectedSnippets.forEach(snippet => snippet.remove());
			this.containingProgram.updateAll();
			this.containingProgram.clearSelection();
		}
	}
		
	addMasterButtonHandlers() {
		if (this.table !== null) {
			this.masterButtons.querySelector(".save").onclick = () => {
				if (!this.isAddingNewSnippet()) {
					this.saveModifications();
				} else {
					this.saveNewSnippet();
				}
			};
			this.masterButtons.querySelector(".cancel").onclick =
				this.cancelModifications.bind(this);
		}
		if (this.selectedSnippets.length > 0) {
			this.masterButtons.querySelector(".delete").onclick =
				this.deleteSelectedSnippets.bind(this);
		}
	}
	
	addHandlers() {
		if (this.table !== null) {
			for (let snippetRef of this.table.querySelectorAll(".snippet-ref")) {
				let referencedSnippet = this.containingProgram.getSnippetById(snippetRef.dataset.refId);
				let refPeekOn = () => {
					referencedSnippet.container.classList.add("ref-peek");
				};
				let refPeekOff = () => {
					referencedSnippet.container.classList.remove("ref-peek");
				};
				snippetRef.onmouseenter = refPeekOn;
				snippetRef.onmouseleave = refPeekOff;
				snippetRef.onclick = () => {
					refPeekOff();
					this.containingProgram.clearSelection();
					referencedSnippet.selected = true;
				}
			}
			
			let actions = {
				name: this.editName,
				track: this.editTrack,
				source: this.editSource,
				start: this.editStart,
				dur: this.editDur
			};
			for (let button of this.table.querySelectorAll(".edit")) {
				button.onclick = actions[button.classList[1]].bind(this);
			}
		}
		
		if (this.addSnippetArea !== null) {
			this.addSnippetArea.onclick = event => {
				let snippet = new Snippet({
					id: this.containingProgram.generateNewId("snippet"),
					source: undefined,
					start: undefined,
					dur: undefined
				});
				snippet.containingProgram = this.containingProgram;
				snippet.containingTrack = undefined;
				this._newSnippet = snippet;
				this.update();
				this.editName();
				this.editTrack();
				this.editSource();
				this.editStart();
				this.editDur();
			};
		}
	}
	
	getPropertyInfoText(prop) {
		if (prop === undefined) {
			return prop;
		}
		let propType = Object.keys(prop)[0];
		switch (propType) {
			case "ref":
				let refName = this.containingProgram.getSnippetById(prop.ref.id).attrs.name;
				let refText = `
					<span class="snippet-ref" data-ref-id="${prop.ref.id}">
						${refName ?? "unnamed snippet"}
					</span>
				`;
				if ("prop" in prop.ref) {
					let refProp = prop.ref.prop.replace(/^dur$/, "duration");
					return `${refProp} of ${refText}`;
				} else {
					return `${refText}`;
				}
				break;
			case "until":
				return "until next " + this.getPropertyInfoText(prop.until);
			case "event":
				let dict = { button_press: "button press", boot: "boot" };
				return dict[prop.event] + " event";
				break;
			case "stream":
				if (prop.stream == "input") {
					return "live input";
				}
				break;
			default:
				return JSON.stringify(prop);
		}
	}
	
	serializeForHTMLAttribute(prop) {
		let serialized;
		if (typeof prop === "object") {
			serialized = JSON.stringify(prop);
		} else if (prop === undefined) {
			serialized = "undefined";
		} else {
			serialized = prop;
		}
		// for some reason pywebview doesn't know the `replaceAll` string method, so
		// instead we have to use `replace` with a regex
		return serialized.replace(new RegExp('"', "g"), "&#34;");
	}
	
	renderTable() {
		let _ = this.serializeForHTMLAttribute;
		return `
			<table>
				<tr>
					<th>name</th>
					<td class="info name" data-original-value="${_(this.currentSnippet.attrs.name)}">
						${this.currentSnippet.attrs.name}
					</td>
					<td><button class="edit name">edit</button></td>
				</tr>
				<tr>
					<th>track</th>
					<td class="info track" data-original-value="${_(this.currentTrack ? this.currentTrack.attrs.id : undefined)}">
						${this.currentTrack ? this.currentTrack.attrs.name : undefined}
					</td>
					<td><button class="edit track">edit</button></td>
				</tr>
				<tr>
					<th>source</th>
					<td class="info source" data-original-value="${_(this.currentSnippet.attrs.source)}">
						${this.getPropertyInfoText(this.currentSnippet.attrs.source)}
					</td>
					<td><button class="edit source">edit</button></td>
				</tr>
				<tr>
					<th>start</th>
					<td class="info start" data-original-value="${_(this.currentSnippet.attrs.start)}">
						${this.getPropertyInfoText(this.currentSnippet.attrs.start)}
					</td>
					<td><button class="edit start">edit</button></td>
				</tr>
				<tr>
					<th>duration</th>
					<td class="info dur" data-original-value="${_(this.currentSnippet.dur)}">
						${this.getPropertyInfoText(this.currentSnippet.dur)}
					</td>
					<td><button class="edit dur">edit</button></td>
				</tr>
			</table>
		`;
	}
	
	renderMasterButtons() {
		let enabledIf = condition => condition ? "" : "disabled";
		return `
			<div class="master-buttons">
				<button class="save" ${enabledIf(this.isCurrentSnippetModified() || this.isAddingNewSnippet())}>
					save
				</button>
				<button class="cancel" ${enabledIf(this.hasStartedEditing())}>
					cancel
				</button>
				<button class="delete" ${enabledIf(this.selectedSnippets.length > 0)}>
					delete
				</button>
			</div>
		`;
	}
	
	renderAddSnippetArea() {
		return `
			<div class="add-snippet-area"><div>
				click here to add a new snippet
			</div></div>
		`;
	}
	
	renderSnippetInfo() {
		return `
			<div class="snippet-info">
				${this.hasOneSnippet() ? this.renderTable() : this.renderAddSnippetArea()}
				${this.renderMasterButtons()}
			</div>
		`;
	}
	
	renderSelectionCount() {
		return `
			<div class="selection-count"><div>
				${!this.isAddingNewSnippet() ? `
					${this.selectedSnippets.length}
					${this.selectedSnippets.length == 1 ? "snippet" : "snippets"} selected
					${this.isCurrentSnippetModified() ? " - <strong>modified</strong>" : ""}
				` : `
					adding new snippet
				`}
			</div></div>
		`;
	}
	
	render() {
		return this.renderSnippetInfo() + this.renderSelectionCount();
	}
	
	updateMasterButtons() {
		this.masterButtons.outerHTML = this.renderMasterButtons();
		this.addMasterButtonHandlers();
	}
	
	updateSelectionCount() {
		this.selectionCount.outerHTML = this.renderSelectionCount();
	}
	
	update() {
		this.container.innerHTML = this.render();
		this.addMasterButtonHandlers();
		this.addHandlers();
	}
}
