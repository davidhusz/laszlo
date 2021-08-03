import webview
from tempfile import TemporaryDirectory
from shutil import copy
import os.path
import subprocess
import sys

from ..compiler import Program


__all__ = ['open_editor']


class API:
	def __init__(self, window = None, fname = None):
		self.window = window
		self.fname = fname or ''
	
	def new(self):
		open_editor(with_start=False)
	
	def open(self):
		new_files = self.window.create_file_dialog(
			webview.OPEN_DIALOG,
			directory = os.path.dirname(self.fname),
			allow_multiple = True,
			file_types = (
				'Laszlo files (*.laszlo)',
				'All files (*.*)'
			)
		)
		if new_files:
			open_multiple_editors(
				[open(file) for file in new_files],
				with_start=False
			)
			return True
		else:
			return False
	
	def save(self, output):
		if self.fname:
			converted_output = Program.fromJSON(output).as_yaml()
			with open(self.fname, mode='w') as file:
				file.write(converted_output)
				return True
		else:
			return self.save_as(output)
	
	def save_as(self, output):
		dest = self.window.create_file_dialog(
			webview.SAVE_DIALOG,
			directory = os.path.dirname(self.fname),
			save_filename = self.fname,
			file_types = (
				'Laszlo files (*.laszlo)',
				'All files (*.*)'
			)
		)
		if dest:
			converted_output = Program.fromJSON(output).as_yaml()
			with open(dest[0], mode='w') as file:
				file.write(converted_output)
			return True
		else:
			return False
	
	def run(self, output):
		converted_output = Program.fromJSON(output).as_python()
		if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
			# If this condition is true, we're running in a PyInstaller bundle,
			# which means that `sys.executable` points to the generated binary
			# rather than the Python interpreter. However, for this method we
			# need to be able to execute arbitrary code in a Python subprocess.
			# For this purpose the CLI has an undocumented `--exec` option, with
			# which we can pass the code we'd like to execute to the Laszlo
			# executable.
			command = [sys.executable, '--exec']
		else:
			command = [sys.executable, '-c']
		command.append(converted_output)
		if sys.platform not in ('win32', 'darwin'):
			self.window.hide()
			subprocess.run(command, check=True)
			self.window.show()
			self.window.restore()
		else:
			subprocess.run(command, check=True, creationflags=subprocess.CREATE_NEW_CONSOLE)
		return True
	
	def export_as_python(self, output):
		dest = self.window.create_file_dialog(
			webview.SAVE_DIALOG,
			directory = os.path.dirname(self.fname),
			save_filename = self.fname,
			file_types = ('Python files (*.py)',)
		)
		if dest:
			converted_output = Program.fromJSON(output).as_python()
			with open(dest[0], mode='w') as file:
				file.write(converted_output+'\n')
			return True
		else:
			return False


def open_editor(input = None, with_start = True):
	# Process input
	if input:
		if type(input) == str:
			program = Program.fromYAML(input)
			fname = None
		else:
			program = Program.fromYAML(input.read())
			fname = input.name if input is not sys.stdin else None
		title = program.attrs.get('title', 'untitled program')
		json = program.as_json()
	else:
		fname = None
		title = 'untitled program'
		json = ''
	# Create temporary directory
	temp_dir = TemporaryDirectory(prefix='laszlo.')
	# Copy over website files
	def script_dir(file):
		return os.path.join(os.path.dirname(__file__), file)
	url = copy(script_dir('editor.html'), temp_dir.name)
	js = copy(script_dir('main.js'), temp_dir.name)
	assets = ['editor.css', 'program.js', 'infopanel.js', 'AreaKilometer50.ttf']
	for asset in assets:
		copy(script_dir(asset), temp_dir.name)
	# Append input to JS file as global variable
	with open(js, mode='a') as file:
		file.write(f'input = {repr(json)};\n')
	# Create window
	api = API(fname=fname)
	window = webview.create_window(
		title = f'{title} - Laszlo Editor',
		url = url,
		js_api = api,
		# TODO: get client screen resolution, perhaps using pyautogui.size, or
		# package screeninfo, or with tkinter
		# https://stackoverflow.com/questions/3129322/how-do-i-get-monitor-resolution-in-python
		width = 1920,
		height = 1080,
		confirm_close = True
	)
	api.window = window
	window.closed += temp_dir.cleanup
	if fname:
		window.closed += file.close
	if with_start:
		webview.start()

def open_multiple_editors(inputs, with_start = True):
	for input in inputs:
		open_editor(input, with_start=False)
	if with_start:
		webview.start()
