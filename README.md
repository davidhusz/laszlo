# Laszlo

`Laszlo` is a Python library for creating flexible audio loopers. Watch the showcase:

[![Showcase thumbnail](https://img.youtube.com/vi/YpCILbPXD2c/hqdefault.jpg)](https://youtu.be/YpCILbPXD2c)

## How to use
Create a new song with one track that simply monitors the input until a button
is pressed:

```python
from laszlo.engine import *
song = Program()
track = song.add_track('my track')
snippet = track.add_snippet(
	source = Input(),
	start = events.Boot(),
	end = events.ButtonPress()
)
song.start()
```

After the button press, loop the previous snippet:

```python
# Insert this before the previous `song.start()`
snippet_loop = track.add_snippet(
	source = snippet,
	start = snippet.end,
	repeat = -1
)
song.start()
```

Overdub bass while the loop is playing, until the next button press, and then
loop that:

```python
bass = song.add_track('bass')
bass_snippet = bass.add_snippet(
	source = Input(),
	start = snippet_loop.start,
	end = events.ButtonPress(),
	fx = [effects.PitchShift(-12)]
)
bass_loop = bass.add_snippet(
	source = bass_snippet,
	start = bass_snippet.end,
	repeat = -1
)
song.start()
```

## Installation
### Using pip

	wget https://github.com/davidhusz/laszlo/releases/download/v0.1.0/laszlo-0.1.0-py3-none-any.whl
	pip install laszlo-0.1.0-py3-none-any.whl

After that you can launch the editor with:

	python3 -m laszlo.gui

To view an example file:

	wget -qO- https://raw.githubusercontent.com/davidhusz/laszlo/main/examples/simple-song.laszlo \
		| python3 -m laszlo.gui -

### On Raspberry Pi
Installation on Raspberry Pi works a little differently than for other Linux
platforms. Since the Pi only makes use of the audio engine (not the GUI), the
only necessary dependency is `pyo`. However, trying to install `pyo` using `pip`
on a Raspberry Pi [will not work](https://github.com/belangeo/pyo/issues/161).
You should instead install it using:

	sudo apt install python3-pyo

We will also need `venv`:

	sudo apt install python3-venv

After that you can install `laszlo` with:

	# the system site packages directory contains our pyo package
	python3 -m venv --system-site-packages laszlo-venv
	source laszlo-venv/bin/activate
	wget https://github.com/davidhusz/laszlo/releases/download/v0.1.0/laszlo-0.1.0-py3-none-any.whl
	python3 -m pip install --no-dependencies laszlo-0.1.0-py3-none-any.whl

Run an example file with:

	python3 <(wget -qO- https://raw.githubusercontent.com/davidhusz/laszlo/main/examples/simple-song.py)

## How to build
### The package
Requires [`sass`](https://sass-lang.com/install).

	git clone https://github.com/davidhusz/laszlo.git
	cd laszlo
	sass src/laszlo/gui/editor.sass src/laszlo/gui/editor.css
	python3 -m build

### Standalone executable for Windows
Run the same commands as for building the package, excluding `python3 -m build`,
but using a Windows shell rather than a *nix shell. After that, switch into
[WSL](https://ubuntu.com/wsl) and run `./create-standalone-binary.sh`. If it
succeeded, the binary will be saved under `./dist`.

## FAQ/Troubleshooting
### I can't hear the input signal/I'm hearing the wrong input channel
Try changing the `pyo.Input(chnl=1)` argument to 0 in of
`src/laszlo/engine/main.py`. Or do it with this command:

	sed 's/pyo.Input(chnl=1)/pyo.Input(chnl=0)/' -i "$(dirname "$(python3 -c 'import laszlo; print(laszlo.__file__)')")/engine/main.py"
