#!/usr/bin/env bash

# This script creates a standalone binary of the Lazlo GUI (it does not include
# the audio engine). It requires PyInstaller.

# TODO:
# set up trap function for recovering __init__.py and removing laszlo_bin

set -euo pipefail

script_dir=$(dirname "$0")
gui_dir=$script_dir/src/laszlo/gui

generate_gui_init () (
	cd "$gui_dir"
	init_script=$(</dev/stdin)
	declare -a assets
	
	# maybe read this from `MANIFEST.in` instead?
	# cat MANIFEST.in | rev | cut -d/ -f1 | rev
	assets=( "editor.html" "main.js" )
	# shellcheck disable=2207
	assets+=( $(<<< "$init_script" sed -n "s/^.*assets = \['\(.*\)'\]$/\1/p" | sed "s/', '/ /g") )
	echo "assets = {"
	for asset in "${assets[@]}"; do
		content=$(python3 -c "file = open('$asset', mode='rb'); print(file.read()); file.close()")
		echo -ne "\t'$asset': "
		if [[ "$asset" != "${assets[-1]}" ]]; then
			echo "$content,"
		else
			echo "$content"
		fi
	done
	echo "}"
	
	echo "
def create_asset(asset, dir):
	fpath = os.path.join(dir, asset)
	with open(fpath, mode='wb') as file:
		file.write(assets[asset])
	return fpath
"
	
	# shellcheck disable=2001
	sed 's/copy(script_dir(\(.*\)), \(.*\))$/create_asset(\1, \2)/' <<< "$init_script"
)

main () (
	gui_init=$gui_dir/__init__.py
	gui_init_backup=$(mktemp)
	echo "Moving $gui_init to $gui_init_backup"
	mv "$gui_init" "$gui_init_backup"
	echo "Generating temporary $gui_init"
	generate_gui_init < "$gui_init_backup" > "$gui_init"
	
	entry_point=$script_dir/laszlo_bin
	echo "Creating entry point $entry_point"
#	echo "from src.laszlo.gui.__main__ import main; main(); exec('''$(<examples/simple-song.py)''')" > "$entry_point"
	echo "from src.laszlo.gui.__main__ import main; main()" > "$entry_point"
	
	# shellcheck disable=1090
	source "$script_dir/venv/bin/activate"
	echo "Generating binary"
	if command -v pyinstaller > /dev/null; then
		pyinstaller=pyinstaller
	elif command -v pyinstaller.exe > /dev/null; then
		# for WSL
		pyinstaller=pyinstaller.exe
	else
		echo "pyinstaller cannot be found. did you activate the virtual environment?"
	fi
#	$pyinstaller --onefile --noconsole --specpath "$script_dir" --collect-submodules laszlo --collect-all pyo "$entry_point"
	$pyinstaller --onefile --noconsole --specpath "$script_dir" "$entry_point"
	
	mv "$gui_init_backup" "$gui_init"
	rm "$entry_point" "$entry_point.spec"
)

main
