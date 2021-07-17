import webview
from tempfile import TemporaryDirectory
from shutil import copy
import os.path

__all__ = ['open_editor']

def open_editor():
    with TemporaryDirectory(prefix='laszlo.') as temp_dir:
        def script_dir(file):
            return os.path.join(os.path.dirname(__file__), file)
        url = copy(script_dir('editor.html'), temp_dir)
        assets = ['editor.css', 'main.js', 'program.js', 'infopanel.js']
        for asset in assets:
            copy(script_dir(asset), temp_dir)
        print(f'Created temporary directory {temp_dir}')
        # TODO: get client screen resolution, perhaps using pyautogui.size, or
        # package screeninfo, or with tkinter
        # https://stackoverflow.com/questions/3129322/how-do-i-get-monitor-resolution-in-python
        webview.create_window('Laszlo Editor', url=url, width=1920, height=1080)
        webview.start()
