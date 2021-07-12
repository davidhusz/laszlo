#!/usr/bin/env python3

import strictyaml as yaml
import re
import sys, argparse


class Program:
	def __init__(self, attrs, tracks):
		self.attrs = attrs
		self.tracks = tracks
		self.dereference_attrs()
	
	@classmethod
	def fromYAML(cls, input):
		parsed_input = yaml.load(input).data
		program_attrs = parsed_input['program']
		tracks = []
		for track_attrs in program_attrs.pop('tracks'):
			snippets = []
			for snippet_attrs in track_attrs.pop('snippets'):
				snippets.append(Snippet(snippet_attrs))
			tracks.append(Track(track_attrs, snippets))
		program = Program(program_attrs, tracks)
		return program
	
	def get_snippet_by_id(self, id):
		for track in self.tracks:
			for snippet in track.snippets:
				if snippet.attrs['id'] == id:
					return snippet
		else:
			raise IndexError(f'no snippet with id {id!r} exists')
	
	def dereference_attrs(self):
		def replace(match):
			ref_id, ref_attr = match.groups()
			ref_name = self.get_snippet_by_id(ref_id).attrs['id']
			return ref_name + ref_attr
		for track in self.tracks:
			for snippet in track.snippets:
				for attr, val in snippet.attrs.items():
					snippet.attrs[attr] = re.sub((
						r'\$(\w+)'       # this group matches the reference id without the dollar sign
						r'((?:\.\w+)*)'  # this group matches any number of attributes (such as '/end')
						), replace, val
					)
	
	def as_python(self):
		title = 'program'
		header = (
			'#!/usr/bin/env python3\n\n'
			'from laszlo.engine import *\n\n'
			f'{title} = Program()\n\n'
		)
		content = '\n\n'.join(track.as_python(title) for track in self.tracks)
		footer = f'\n\n{title}.start()\n'
		return header + content + footer


class Track:
	def __init__(self, attrs, snippets):
		self.attrs = attrs
		self.snippets = snippets
	
	def as_python(self, program_name):
		id = self.attrs['id']
		name = repr(self.attrs['name'])
		header = f"{id} = {program_name}.add_track({name})\n\n"
		content = '\n\n'.join(snippet.as_python(id) for snippet in self.snippets)
		return header + content


class Snippet:
	def __init__(self, attrs):
		self.attrs = attrs
		if self.attrs['source'] == 'input':
			self.attrs['source'] = 'Input()'
		def replace_event(event):
			if event == 'button_press':
				return 'events.ButtonPress()'
			elif event == 'boot':
				return 'events.Boot()'
			elif event == 'shutdown':
				return 'events.Shutdown()'
			else:
				return event
		for event in ['start', 'end']:
			if event in self.attrs:
				self.attrs[event] = replace_event(self.attrs[event])
	
	def as_python(self, track_name):
		attrs = self.attrs.copy()  # we will be removing items, so we need a deep copy
		id = attrs.pop('id')
		if 'name' in attrs:
			attrs['name'] = repr(attrs['name'])
			del attrs['name']  # TODO: allow name attributes for snippets in engine
		args = ',\n\t'.join(f'{attr} = {val}' for attr, val in attrs.items())
		output = f'{id} = {track_name}.add_snippet(\n\t{args}\n)'
		return output


def laszlo2python(input):
	program = Program.fromYAML(input)
	return program.as_python()


if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('input', nargs='?', default=sys.stdin, type=argparse.FileType('r'))
	parser.add_argument('-o', '--output', default=sys.stdout, type=argparse.FileType('w'))
	args = parser.parse_args()
	args.output.write(laszlo2python(args.input.read()))
