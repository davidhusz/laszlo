from .snippets import UndeterminedDuration
import threading, time


__all__ = [
	'Event',
	'Time',
	'ButtonPress',
	'Boot'
]


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
		self.trigger = trigger
		self.delay = delay
		super().__init__()
		if isinstance(delay, UndeterminedDuration):
			def action():
				threading.Timer(self.delay.compute(), self.emit).start()
		else:
			def action():
				threading.Timer(self.delay, self.emit).start()
		self.trigger.add_action(action)


class ButtonPress(Event):
	'''
	An event that fires each time a button/footswitch is pressed.
	'''
	pass


class Boot(Event):
	'''
	An event that fires when the program starts.
	'''
	# TODO: raise Error if instantiated multiple times
	pass


_handler = EventHandler()
