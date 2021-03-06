#!/usr/bin/env python3

from laszlo.engine import *

program = Program()

t1 = program.add_track('rhythm guitar')

s1 = t1.add_snippet(
	source = Input(),
	start = events.Boot(),
	end = events.ButtonPress()
)

s2 = t1.add_snippet(
	source = Input(),
	start = s1.end,
	end = events.ButtonPress()
)

s3 = t1.add_snippet(
	source = Input(),
	start = s2.end,
	end = events.ButtonPress()
)

s4 = t1.add_snippet(
	source = s2,
	start = s3.end
)

s5 = t1.add_snippet(
	source = s3,
	start = s4.end
)

s6 = t1.add_snippet(
	source = Input(),
	start = s5.end,
	end = events.ButtonPress()
)

s12 = t1.add_snippet(
	source = s3,
	start = s6.end
)

t2 = program.add_track('bass')

s7 = t2.add_snippet(
	source = Input(),
	start = s3.end,
	dur = s2.dur,
	# this here is an example of something that we can add using the python
	# module, but which isn't (yet) available as a feature in the gui - fx
	# chains on top of a snippet
	fx = [effects.PitchShift(-12)]
)

s8 = t2.add_snippet(
	source = Input(),
	start = s7.end,
	dur = s3.dur,
	fx = [effects.PitchShift(-12)]
)

s9 = t2.add_snippet(
	source = s8,
	start = s6.end,
	fx = [effects.PitchShift(-12)]
)

t3 = program.add_track('lead guitar')

s10 = t3.add_snippet(
	source = Input(),
	start = s6.end,
	dur = s3.dur
)

program.start()
