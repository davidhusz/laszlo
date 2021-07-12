#!/usr/bin/env python3

from looper import *

song = Program()
track = song.add_track()
pre = track.add_snippet(Input(), start=events.Boot(), end=events.ButtonPress())
snippet1 = track.add_snippet(Input(), start=pre.end, end=events.ButtonPress())
snippet1_loop = track.add_snippet(snippet1, start=snippet1.end, repeat=-1)
snippet2 = track.add_snippet(Input(), snippet1.end+snippet1.dur, dur=snippet1.dur)
snippet2_loop = track.add_snippet(snippet2, start=snippet2.end, repeat=-1)
song.start()
