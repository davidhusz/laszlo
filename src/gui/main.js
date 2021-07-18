"use strict";

// Global variables
var input, program;

window.addEventListener("DOMContentLoaded", () => {
	let options = {
		mixerContainer: document.querySelector("#mixer"),
		workspaceContainer: document.querySelector("#workspace"),
		infoPanelContainer: document.querySelector("#info-panel")
	};
	if (input) {
		program = Program.fromJSON(input, options);
	} else {
		program = new Program({ title: "untitled program" }, [], options);
		program.addTrack("untitled track");
	}
	document.querySelector("#main-menu .new").onclick = () => {
		// for some reason pywebview is still undefined when this script is loaded,
		// which is why we have to wrap it in an anonymous function
		pywebview.api.new().catch(error => alert(error));
	}
	document.querySelector("#main-menu .open").onclick = () => {
		pywebview.api.open().catch(error => alert(error));
	};
});
