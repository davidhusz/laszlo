import pyo


class Effect:
    pass


class PitchShift(Effect):
    def __init__(self, interval):
        self.interval = interval
    
    def __call__(self, input):
        return pyo.Harmonizer(input, transpo=self.interval)
