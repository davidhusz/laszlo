#!/usr/bin/env python3

from looper import *

song = Program()
pre = song.add_snippet(Input(), start=Boot(), end=ButtonPress())
snippet1 = song.add_snippet(Input(), start=pre.end, end=ButtonPress())
snippet1_loop = song.add_snippet(snippet1, start=snippet1.end, repeat=-1)
snippet2 = song.add_snippet(Input(), snippet1.end+snippet1.dur, dur=snippet1.dur)
snippet2_loop = song.add_snippet(snippet2, start=snippet2.end, repeat=-1)
song.start()
