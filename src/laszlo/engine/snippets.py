import pyo
import time

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


class UndeterminedDuration:
	def __init__(self, snippet, factor = 1):
		self.snippet = snippet
		self.factor = factor
	
	def compute(self):
		return self.snippet.dur * self.factor
	
	def __mul__(self, other):
		return UndeterminedDuration(self.snippet, other)
	
	def __rmul__(self, other):
		return self.__mul__(other)


class BaseSnippet:
	def __init__(self, source, start, end, dur, repeat, fx, monitoring):
		self.source = source
		self.start = start
		self._end = end
		self._dur = dur
		self.repeat = repeat
		self.fx = fx or []
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
		self.apply_fx()
		
	def apply_fx(self):
		for effect in self.fx:
			self._raw_source = effect(self._raw_source)
	
	def start_monitoring(self):
		self._raw_source.out()
	
	def stop_monitoring(self):
		# TODO: find a way to stop just the outputting, not the processing
		self._raw_source.stop()


class ClonedSnippet(BaseSnippet):
	def __init__(self, source, *args):
		super().__init__(source, *args)
		self.dur = self.dur or source.dur
		source.recording = True
	
	def apply_fx(self):
		for effect in self.fx:
			self.player = effect(self.player)
	
	def start_playback(self):
		self.player = pyo.TableRead(self.table, freq=self.table.getRate()).play()
		self.apply_fx()
	
	def start_playback_loop(self):
		self.player = pyo.TableRead(self.table, freq=self.table.getRate(), loop=1).play()
		self.apply_fx()
	
	def stop_playback(self):
		self.player.stop()
	
	def start_monitoring(self):
		self.player.out()
	
	def stop_monitoring(self):
		# TODO: find a way to stop just the outputting, not the processing
		self.player.stop()


class UndeterminedLengthSnippet(BaseSnippet):
	def __init__(self, *args):
		super().__init__(*args)
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
	def __init__(self, *args):
		super().__init__(*args)
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
	def __init__(self, source, start, end, dur, repeat, fx, monitoring):
		# We're calling the parent class methods explicitly here for two reasons:
		# 1. To ensure that they're called in the specified order, since Python
		#    calls parent __init__ methods in *opposite* method resolution order
		#    by default
		# 2. To pass self.dur rather than dur to DependentLengthSnippet, since
		#    ClonedSnippet potentially assigns a value different than dur to
		#    self.dur
		ClonedSnippet.__init__(self, source, start, end, dur, repeat, fx, monitoring)
		DependentLengthSnippet.__init__(self, source, start, end, self.dur, repeat, fx, monitoring)
	
	def _define_events(self):
		if not self.recording:
			def clone_table():
				self.table = self.source.table
			self.source.end.add_action(clone_table)
			if self.repeat == 1:
				self.start.add_action(self.start_playback, self.start_monitoring)
			elif self.repeat != 0:
				self.start.add_action(self.start_playback_loop, self.start_monitoring)
				if self.repeat != -1:
					self.end = self.start + (self.repeat * self.dur)
					self.end.add_action(self.stop_playback)
		else:
			raise NotImplementedError
