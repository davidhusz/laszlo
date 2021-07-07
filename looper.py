import pyo
import threading, time

__all__ = [
	'Event',
	'Time',
	'ButtonPress',
	'Boot',
	'Input',
	'Program'
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
		elif isinstance(event, Boot):
			self.boot = event
	
	def emit_event(self, event_type):
		if event_type == ButtonPress:
			# TODO: raise error if not expecting press
			press = self.button_presses.pop(0)
			press.emit()
		elif event_type == Boot:
			# TODO: raise error if already booted
			if hasattr(self, 'boot'):
				self.boot.emit()
	
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
	
	def __add__(self, other):
		return Time(self, other)
	
	def __radd__(self, other):
		return self.__add__(other)
	
	@property
	def time(self):
		if self.__time is not None:
			return self.__time
		else:
			raise Exception('oh no, event has not happened yet')


class Time(Event):
	def __init__(self, trigger, delay):
		super().__init__()
		if isinstance(delay, UndeterminedDuration):
			def action():
				threading.Timer(delay.compute(), self.emit).start()
		else:
			def action():
				threading.Timer(delay, self.emit).start()
		trigger.add_action(action)


class ButtonPress(Event):
	pass


class Boot(Event):
	# TODO: raise Error if instantiated multiple times
	pass


class Source:
	pass


class Input(Source):
	def get_raw(self):
		return pyo.Input(chnl=1).mix(2)


class Program:
	def __init__(self):
		self.snippets = []
		
	def add_snippet(self, source, start, *, end = None, dur = None, repeat = None, monitoring = True):
		# TODO: refactoring
		if repeat is None:
			repeat_was_default = True
			repeat = 1
		else:
			repeat_was_default = False
		args = (source, start, end, dur, repeat, monitoring)
		if isinstance(source, Input):
			if not repeat_was_default:
				raise Exception('oh no, `repeat` is not an option for live input snippets')
			elif end is not None and dur is not None:
				raise Exception('oh no, cant have `end` and `dur` in args')
			elif end is None and dur is None:
				raise Exception('oh no, must have `end` or `dur` in args')
			elif end is not None:
				snippet = LiveUndeterminedLengthSnippet(*args)
			elif isinstance(dur, UndeterminedDuration):
				snippet = LiveDependentLengthSnippet(*args)
			elif isinstance(dur, (float, int)):
				# snippet = LiveFixedLengthSnippet(*args)
				pass
			else:
				raise Exception('oh no, this shouldnt be able to happen')
		elif isinstance(source, (BaseSnippet, str)):
			if end is not None and dur is not None:
				raise Exception('oh no, cant have `end` and `dur` in args')
			elif (end is not None or dur is not None) and repeat not in (-1, 0, 1):
				raise Exception('oh no, cant have `end` or `dur` and a specific `repeat`')
			elif end is not None:
				if isinstance(source, BaseSnippet):
					# snippet = ClonedUndeterminedLengthSnippet(*args)
					pass
				else:
					# snippet = PrerecordedUndeterminedLengthSnippet(*args)
					pass
			elif dur is None or isinstance(dur, UndeterminedDuration):
				if isinstance(source, BaseSnippet):
					snippet = ClonedDependentLengthSnippet(*args)
				else:
					# snippet = PrerecordedDependentLengthSnippet(*args)
					pass
			elif isinstance(dur, (float, int)):
				if isinstance(source, BaseSnippet):
					# snippet = ClonedFixedLengthSnippet(*args)
					pass
				else:
					# snippet = PrerecordedFixedLengthSnippet(*args)
					pass
			else:
				raise Exception('oh no, this shouldnt be able to happen')
		else:
			raise Exception('oh no, this shouldnt be able to happen')
		self.snippets.append(snippet)
		return snippet
	
	def start(self):
		server = pyo.Server().boot()
		server.start()
		for snippet in self.snippets:
			snippet._define_events()
		_handler.emit_event(Boot)
		while True:
			wait()
			_handler.emit_event(ButtonPress)
			if not _handler.is_expecting_event(ButtonPress):
				print('Program finished. Press Enter now at any time to exit.')
				wait()
				print('Goodbye!')
				server.stop()
				break


class UndeterminedDuration:
	def __init__(self, snippet):
		self.snippet = snippet
	
	def compute(self):
		return self.snippet.dur


class BaseSnippet:
	def __init__(self, source, start, end, dur, repeat, monitoring):
		self.source = source
		self.start = start
		self._end = end
		self._dur = dur
		self.repeat = repeat
		self.monitoring = monitoring
		self.recording = False
	
	def signal_recording_start(self):
		on_air()
	
	def signal_recording_stop(self):
		off_air()
		print(f'Snippet length: {self.dur:.3f}s')
	
	def signal_monitoring_start(self):
		# This should light up the LED ina different color than for recording,
		# but right now you only have it one color
		pass
	
	def signal_monitoring_stop(self):
		# same as above
		pass
	
	def start_recording(self):
		self.recorder.play()


class LiveSnippet(BaseSnippet):
	def _instantiate_raw_source(self):
		self._raw_source = self.source.get_raw()
	
	def start_monitoring(self):
		self._raw_source.out()
	
	def stop_monitoring(self):
		# TODO: find a way to stop just the outputting, not the processing
		self._raw_source.stop()


class ClonedSnippet(BaseSnippet):
	def __init__(self, source, *args, **kwargs):
		super().__init__(source, *args, **kwargs)
		source.recording = True
	
	def start_playback(self):
		self.player = pyo.Osc(self.table, freq=self.table.getRate()).play()
	
	def stop_playback(self):
		self.player.stop()
	
	def start_monitoring(self):
		self.player.out()
	
	def stop_monitoring(self):
		# TODO: find a way to stop just the outputting, not the processing
		self.player.stop()


class UndeterminedLengthSnippet(BaseSnippet):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.end = self._end
	
	def stop_recording(self):
		dur_in_samples = int(self.dur * self.template_table.getSamplingRate())
		self.table = pyo.DataTable(dur_in_samples, chnls=2)
		self.table.copyData(self.template_table)
		del self.template_table
	
	@property
	def dur(self):
		try:
			return self.end.time - self.start.time
		except:
			return UndeterminedDuration(self)


class DependentLengthSnippet(BaseSnippet):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.end = self.start + self._dur
		self.dur = self._dur


class LiveUndeterminedLengthSnippet(LiveSnippet, UndeterminedLengthSnippet):
	def _define_events(self):
		super()._instantiate_raw_source()
		if self.recording:
			self.template_table = pyo.NewTable(_snippet_init_length, chnls=2)
			self.recorder = pyo.TableRec(self._raw_source, self.template_table)
			self.start.add_action(self.start_recording, self.signal_recording_start)
			self.end.add_action(self.stop_recording, self.signal_recording_stop)
		if self.monitoring:
			self.start.add_action(self.start_monitoring, self.signal_monitoring_start)
			self.end.add_action(self.stop_monitoring, self.signal_monitoring_stop)


class LiveDependentLengthSnippet(LiveSnippet, DependentLengthSnippet):
	def _define_events(self):
		super()._instantiate_raw_source()
		if self.recording:
			if not isinstance(self.dur, UndeterminedDuration):
				self.table = pyo.NewTable(self.dur, chnls=2)
				self.recorder = pyo.TableRec(self._raw_source, self.table)
			else:
				def create_table():
					self.dur = self.dur.compute()
					self.table = pyo.NewTable(self.dur, chnls=2)
					self.recorder = pyo.TableRec(self._raw_source, self.table)
				self.start.add_action(create_table)
			self.start.add_action(self.start_recording, self.signal_recording_start)
			self.end.add_action(self.signal_recording_stop)
		if self.monitoring:
			self.start.add_action(self.start_monitoring, self.signal_monitoring_start)
			self.end.add_action(self.stop_monitoring, self.signal_monitoring_stop)


class ClonedDependentLengthSnippet(ClonedSnippet, DependentLengthSnippet):
	# TODO: account for repeat/dur parameters
	# TODO: enable recordings
	def _define_events(self):
		if not self.recording:
			def clone_table():
				self.table = self.source.table
			self.source.end.add_action(clone_table)
			self.start.add_action(self.start_playback)
			if self.monitoring:
				self.start.add_action(self.start_monitoring)
		else:
			raise NotImplementedError


_handler = EventHandler()
