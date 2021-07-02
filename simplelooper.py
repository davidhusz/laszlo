#!/usr/bin/env python3

from looper import *

song = Program()
topLayer = song.add_snippet(start=ButtonPress(), end=ButtonPress())
#topLayerLoop = song.add_copy(topLayer, start=topLayer.end, times=-1)
#bottomLayer = song.add_snippet(start=topLayer.end+topLayer.dur, dur=topLayer.dur)
#bottomLayerLoop = song.add_copy(bottomLayer, start=bottomLayer.end+bottomLayer.dur, times=1)
song.start()
