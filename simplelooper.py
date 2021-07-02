#!/usr/bin/env python3

from looper import Program, Input, Boot, ButtonPress

song = Program()
pre = song.add_snippet(Input(), start=Boot(), end=ButtonPress())
topLayer = song.add_snippet(Input(), start=pre.end, end=ButtonPress())
topLayer.recording = True
topLayer.end.add_action(topLayer.start_playback)
#topLayerLoop = song.add_copy(topLayer, start=topLayer.end, times=-1)
#bottomLayer = song.add_snippet(start=topLayer.end+topLayer.dur, dur=topLayer.dur)
#bottomLayerLoop = song.add_copy(bottomLayer, start=bottomLayer.end+bottomLayer.dur, times=1)
song.start()
