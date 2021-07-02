import pyo
import time

__all__ = [
	'EventHandler',
	'Event',
	'ButtonPress',
	'Program',
	'Snippet',
	'DependentLengthSnippet',
	'_handler'
]

# TODO:
# consistent camel/snake casing (where appropriate)
# make Snippet and Source an abstract base class?
# replace all instances of 'oh no' with actual error messages

try:
	from gpiozero import *
	raspberry = True
	led = LED(18)
	button = Button(25)
	on_air = led.on
	off_air = led.off
	wait = button.wait_for_press
except ModuleNotFoundError:
	raspberry = False
	on_air = lambda: print('Now recording')
	off_air = lambda: print('Stopped recording')
	wait = input

_snippet_init_length = 60
#_min_rec_length = 1


class EventHandler:
	def __init__(self):
		self.button_presses = []
	
	def add_event(self, event):
		if isinstance(event, ButtonPress):
			self.button_presses.append(event)
	
	def emit_event(self, event_type):
		if event_type == ButtonPress:
			# TODO: raise error if not expecting press
			press = self.button_presses.pop(0)
			press.emit()
	
	def is_expecting_event(self, event_type):
		if event_type == ButtonPress:
			return len(self.button_presses) > 0


class Event:
	def __init__(self, actions = None):
		# DO NOT think that you can refactor things by replacing the `None` in the parameter list with `[]`. It will lead to all instances of this class having their `actions` point to the same list instance, and it took me way too long to find that out
		self.__time = None
		self.actions = actions or []
		_handler.add_event(self)
	
	def add_action(self, *actions):
		self.actions.extend(actions)
	
	def emit(self):
		self.__time = time.time()
		self.execute_actions()
	
	def execute_actions(self):
		for action in self.actions:
			# TODO: add parameter for specifying whether actions should be executed asynchronously or not (by default not)
			action()
	
	@property
	def time(self):
		if self.__time is not None:
			return self.__time
		else:
			exit('oh no, event has not happened yet')


class ButtonPress(Event):
	pass


class Source:
	@property
	def raw(self):
		pass


class Input(Source):
	@property
	def raw(self):
		return pyo.Input(chnl=1).mix(2).out()


class Program:
	def __init__(self):
		self.snippets = []
	
	def add_snippet(self, **kwargs):
		# only does dependent length snippets and fixed length snippets as of now,
		# not cloned snippets
		if 'dur' in kwargs and 'end' in kwargs:
			exit('oh no, cant have `dur` and `end` in args')
		elif not 'dur' in kwargs and not 'end' in kwargs:
			exit('oh no, must have `dur` or `end` in args')
		elif 'end' in kwargs:
			snippet = DependentLengthSnippet(**kwargs)
		elif 'dur' in kwargs:
			snippet = FixedLengthSnippet(**kwargs)
		self.snippets.append(snippet)
		return snippet
	
	def start(self):
		server = pyo.Server().boot()
		server.start()
		for snippet in self.snippets:
			snippet._instantiate_pyo_objects()
		while True:
			wait()
			_handler.emit_event(ButtonPress)
			if not _handler.is_expecting_event(ButtonPress):
				print('Program finished. Press Enter now at any time to exit.')
				wait()
				print('Goodbye!')
				server.stop()
				break


class Snippet:
	@property
	def dur(self):
		return self.end.time - self.start.time


class DependentLengthSnippet(Snippet):
	def __init__(self, start, end = None):
		self.source = Input()
		self.start = start
		self.end = end
		self.start.add_action(self.start_recording)
		self.end.add_action(self.stop_recording, self.start_playback)
	
	def _instantiate_pyo_objects(self):
		self.template_table = pyo.NewTable(_snippet_init_length, chnls=2)
		self.recorder = pyo.TableRec(self.source.raw, self.template_table)
	
	def start_recording(self):
		self.recorder.play()
		on_air()
	
	def stop_recording(self):
		dur_in_samples = int(self.dur * self.template_table.getSamplingRate())
		self.table = pyo.DataTable(dur_in_samples, chnls=2)
		self.table.copyData(self.template_table)
		del self.template_table
		off_air()
		print(f'Snippet length: {self.dur:.3f}s')
	
	def start_playback(self):
		self.osc = pyo.Osc(self.table, freq=self.table.getRate()).out()


_handler = EventHandler()
