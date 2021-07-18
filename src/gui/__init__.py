import webview
from tempfile import TemporaryDirectory
from shutil import copy
import os.path

from ..compiler import Program


__all__ = ['open_editor']


class API:
    def new(self):
        open_editor(with_start=False)


def open_editor(input = None, with_start = True):
    # Process input
    if input:
        if type(input) == str:
            program = Program.fromYAML(input)
        else:
            program = Program.fromYAML(input.read())
        title = program.attrs.get('title', 'untitled program')
        json = program.as_json()
    else:
        title = 'untitled program'
        json = ''
    # Create temporary directory
    temp_dir = TemporaryDirectory(prefix='laszlo.')
    # Copy over website files
    def script_dir(file):
        return os.path.join(os.path.dirname(__file__), file)
    url = copy(script_dir('editor.html'), temp_dir.name)
    js = copy(script_dir('main.js'), temp_dir.name)
    assets = ['editor.css', 'program.js', 'infopanel.js']
    for asset in assets:
        copy(script_dir(asset), temp_dir.name)
    # Append input to JS file as global variable
    with open(js, mode='a') as file:
        file.write(f'input = {repr(json)};\n')
    # Create window
    api = API()
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
    if with_start:
        webview.start()

def open_multiple_editors(inputs):
    for input in inputs:
        open_editor(input, with_start=False)
    webview.start()
