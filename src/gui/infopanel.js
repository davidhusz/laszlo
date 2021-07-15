"use strict";

class InfoPanel {
	constructor(container) {
		this.container = container;
	}
	
	get table() {
		return this.container.querySelector(".snippet-info table");
	}
	
	get masterButtons() {
		return this.container.querySelector(".master-buttons");
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
		if (this.selectedSnippets.length == 1) {
			return this.selectedSnippets[0];
		} else if (this.selectedSnippets.length == 0) {
			console.error("No snippet selected");
		} else {
			console.error("More than one snippet selected");
		}
	}
	
	get currentTrack() {
		return this.currentSnippet.containingTrack;
	}
	
	hasOneSnippet() {
		return this.selectedSnippets.length == 1;
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
	
	editName() {
		this.editProperty(
			"name",
			originalValue => `<input type="text" value="${originalValue}">`
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
					</select>
				`
		);
	}
	
	editSource() {
		let _ = this.serializeForHTMLAttribute;
		this.editProperty(
			"source",
			originalValue =>
				`
					<select>
						<option value="${_({stream: "input"})}">live input</option>
						<option value="clone">clone another snippet...</option>
						<option value="file">from file...</option>
					</select>
				`,
			editor => {
				if (editor.value == "clone") {
					this.containingProgram.chooseSnippet(newSource => {
						this.containingProgram.chooseSnippetModeOverlay.classList.remove("active");
						let newValue = {
							ref: { id: newSource.attrs.id }
						};
						let newOption = document.createElement("option");
						newOption.setAttribute("value", _(newValue));
						newOption.innerHTML = this.getPropertyInfoText(newValue);
						editor.appendChild(newOption);
						editor.value = _(newValue);
						return JSON.stringify(newValue);
					});
				}
			}
		);
	}
	
	editProperty(propName, editorCreator, inputHandler = null) {
		let propInfo = this.table.querySelector(`.${propName}.info`);
		if (!propInfo.classList.contains("started-editing")) {
			let originalValue = propInfo.dataset.originalValue;
			propInfo.innerHTML = editorCreator(originalValue);
			propInfo.classList.add("started-editing");
			this.updateMasterButtons();
			let editor = propInfo.children[0];
			if (editor.tagName == "INPUT") {
				editor.select();
			}
			editor.oninput = () => {
				if (editor.value !== originalValue) {
					if (inputHandler !== null) {
						propInfo.dataset.modifiedValue = inputHandler(editor);
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
	
	saveModifications() {
		for (let prop of this.table.querySelectorAll(".info")) {
			let propInfo = prop.dataset;
			if (propInfo.modifiedValue !== undefined &&
				propInfo.modifiedValue != propInfo.originalValue) {
					switch (prop.classList[1]) {
						case "name":
							this.currentSnippet.changeName(propInfo.modifiedValue);
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
	
	addMasterButtonHandlers() {
		if (this.table !== null) {
			this.masterButtons.querySelector(".save").onclick = this.saveModifications.bind(this);
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
				// all instances of `(function(){})` are just placeholders for now which
				// do nothing
				name: this.editName,
				track: this.editTrack,
				source: this.editSource,
				start: (function(){}),
				end: (function(){}),
				dur: (function(){})
			};
			for (let button of this.table.querySelectorAll(".edit")) {
				button.onclick = actions[button.classList[1]].bind(this);
			}
		}
	}
	
	getPropertyInfoText(prop) {
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
					return `tied to ${refProp} of ${refText}`;
				} else {
					return `clone of ${refText}`;
				}
				break;
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
					<td class="info track" data-original-value="${this.currentTrack.attrs.id}">
						${this.currentTrack.attrs.name}
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
					<th>end</th>
					<!-- TODO: serialize original value, consider cases where it is not present -->
					<td class="info end" data-original-value="">
						${"end" in this.currentSnippet.attrs ? this.getPropertyInfoText(this.currentSnippet.attrs.end) : ""}
					</td>
					<td><button class="edit end">edit</button></td>
				</tr>
				<tr>
					<th>duration</th>
					<!-- TODO: serialize original value, consider cases where it is not present -->
					<td class="info dur" data-original-value="">
						${"dur" in this.currentSnippet.attrs ? this.getPropertyInfoText(this.currentSnippet.attrs.dur) : ""}
					</td>
					<td><button class="edit dur">edit</button></td>
				</tr>
			</table>
		`;
	}
	
	renderMasterButtons() {
		let disabled = this.isCurrentSnippetModified() ? "" : "disabled";
		return `
			<div class="master-buttons">
				<button class="save" ${disabled}>save</button>
				<button class="cancel" ${this.hasStartedEditing() ? "" : "disabled"}>cancel</button>
				<button class="delete">delete</button>
			</div>
		`;
	}
	
	renderSnippetInfo() {
		return `
			<div class="snippet-info">
				${this.hasOneSnippet() ? this.renderTable() : ""}
				${this.renderMasterButtons()}
			</div>
		`;
	}
	
	renderSelectionCount() {
		return `
			<div class="selection-count"><div>
				${this.selectedSnippets.length}
				${this.selectedSnippets.length == 1 ? "snippet" : "snippets"} selected
				${this.isCurrentSnippetModified() ? " - <strong>modified</strong>" : ""}
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
		this.addHandlers();
	}
}
