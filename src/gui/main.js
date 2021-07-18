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
	
	let addMainMenuHandler = function(action, argumentProviders = [], messageOnEffect = null) {
		document.querySelector(`#main-menu .${action}`).onclick = () => {
			// for some reason pywebview doesn't know the `replaceAll` string method,
			// so instead we have to use `replace` with a regex
			let apiMethod = action.replace(new RegExp("-", "g"), "_")
			let args = argumentProviders.map(provider => provider());
			pywebview.api[apiMethod](...args)
				.then(hadEffect => {
					if (hadEffect && messageOnEffect) {
						program.infoPanel.selectionCount.querySelector("div").innerText = messageOnEffect;
					}
				}).catch(error => {
					alert(error);
				});
		};
	};
	
	addMainMenuHandler("new");
	addMainMenuHandler("open");
});
