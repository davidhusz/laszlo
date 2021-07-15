"use strict";

// Global variable for development purposes
var program;

window.addEventListener("DOMContentLoaded", () => {
	let test_input = `{"program":{"title":"Woman (Oh Woman)","tracks":[{"id":"t1","name":"rhythm guitar","snippets":[{"id":"s1","name":"pre","source":{"stream":"input"},"start":{"event":"boot"},"end":{"event":"button_press"}},{"id":"s2","name":"verse guitar","source":{"stream":"input"},"start":{"ref":{"id":"s1","prop":"end"}},"end":{"event":"button_press"}},{"id":"s3","name":"chorus guitar","source":{"stream":"input"},"start":{"ref":{"id":"s2","prop":"end"}},"end":{"event":"button_press"}},{"id":"s4","source":{"ref":{"id":"s2"}},"start":{"ref":{"id":"s3","prop":"end"}}},{"id":"s5","source":{"ref":{"id":"s3"}},"start":{"ref":{"id":"s4","prop":"end"}}},{"id":"s6","name":"bridge guitar","source":{"stream":"input"},"start":{"ref":{"id":"s5","prop":"end"}},"end":{"event":"button_press"}},{"id":"s12","source":{"ref":{"id":"s3"}},"start":{"ref":{"id":"s6","prop":"end"}}}]},{"id":"t2","name":"bass","snippets":[{"id":"s7","name":"verse bass","source":{"stream":"input"},"start":{"ref":{"id":"s3","prop":"end"}},"dur":{"ref":{"id":"s2","prop":"dur"}}},{"id":"s8","name":"chorus bass","source":{"stream":"input"},"start":{"ref":{"id":"s7","prop":"end"}},"dur":{"ref":{"id":"s3","prop":"dur"}}},{"id":"s9","source":{"ref":{"id":"s8"}},"start":{"ref":{"id":"s6","prop":"end"}}}]},{"id":"t3","name":"lead guitar","snippets":[{"id":"s10","name":"chorus lead guitar","source":{"stream":"input"},"start":{"ref":{"id":"s6","prop":"end"}},"dur":{"ref":{"id":"s3","prop":"dur"}}}]}]},"version":"0.0"}`
	program = Program.fromJSON(test_input, {
		mixerContainer: document.querySelector("#mixer"),
		workspaceContainer: document.querySelector("#workspace"),
		infoPanelContainer: document.querySelector("#info-panel")
	});
});
