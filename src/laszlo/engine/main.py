from .snippets import *
from . import events, effects
import pyo


# TODO:
# consistent camel/snake casing (where appropriate)
# make Snippet and Source an abstract base class?
# replace all instances of 'oh no' with actual error messages


class Source:
	pass


class Input(Source):
	def get_raw(self):
		if not raspberry:
			return pyo.Input(chnl=1).mix(2)
		else:
			return pyo.Input(chnl=0).mix(2)


class Program:
	def __init__(self):
		self.tracks = []
	
	def add_track(self, name = None):
		track = Track(name or 'Untitled track')
		self.tracks.append(track)
		return track
	
	def _boot_server(self):
		if not raspberry:
			self.server = pyo.Server().boot()
		else:
			self.server = pyo.Server(ichnls=1).boot()
		self.server.start()
	
	def _define_events(self):
		for track in self.tracks:
			track._define_events()
	
	def start(self):
		self._boot_server()
		self._define_events()
		events._handler.emit_event(events.Boot)
		while True:
			wait()
			events._handler.emit_event(events.ButtonPress)
			if not events._handler.is_expecting_event(events.ButtonPress):
				print('Program finished. Press Enter now at any time to exit.')
				wait()
				print('Goodbye!')
				self.server.stop()
				break


class Track:
	def __init__(self, name):
		self.name = name
		self.snippets = []
	
	def add_snippet(self, source, start, *, end = None, dur = None, repeat = None, fx = None, monitoring = True):
		# TODO: refactoring
		if repeat is None:
			repeat_was_default = True
			repeat = 1
		else:
			repeat_was_default = False
		args = (source, start, end, dur, repeat, fx, monitoring)
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
				raise NotImplementedError
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
					raise NotImplementedError
				else:
					# snippet = PrerecordedUndeterminedLengthSnippet(*args)
					raise NotImplementedError
			elif dur is None or isinstance(dur, UndeterminedDuration):
				if isinstance(source, BaseSnippet):
					snippet = ClonedDependentLengthSnippet(*args)
				else:
					# snippet = PrerecordedDependentLengthSnippet(*args)
					raise NotImplementedError
			elif isinstance(dur, (float, int)):
				if isinstance(source, BaseSnippet):
					# snippet = ClonedFixedLengthSnippet(*args)
					raise NotImplementedError
				else:
					# snippet = PrerecordedFixedLengthSnippet(*args)
					raise NotImplementedError
			else:
				raise Exception('oh no, this shouldnt be able to happen')
		else:
			raise Exception('oh no, this shouldnt be able to happen')
		self.snippets.append(snippet)
		return snippet
	
	def _define_events(self):
		for snippet in self.snippets:
			snippet._define_events()
