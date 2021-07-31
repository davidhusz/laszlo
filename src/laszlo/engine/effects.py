import pyo


class Effect:
    pass


class PitchShift(Effect):
    def __init__(self, interval):
    '''
    A pitch shift effect.
    
    interval: The shift interval in semitones
    '''
        self.interval = interval
    
    def __call__(self, input):
        return pyo.Harmonizer(input, transpo=self.interval)
