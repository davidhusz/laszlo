#!/usr/bin/env python3

import strictyaml as yaml
import json
import ast
import sys, argparse


class Program:
	def __init__(self, attrs, tracks):
		self.attrs = attrs
		self.tracks = tracks
	
	@classmethod
	def fromYAML(cls, input):
		parsed_input = yaml.load(input).data
		version = parsed_input['version']
		program_attrs = parsed_input['program']
		tracks = []
		for track_attrs in program_attrs.pop('tracks'):
			snippets = []
			for snippet_attrs in track_attrs.pop('snippets'):
				snippets.append(Snippet(snippet_attrs))
			tracks.append(Track(track_attrs, snippets))
		program = cls(program_attrs, tracks)
		program.version = version
		return program
	
	def get_snippet_by_id(self, id):
		for track in self.tracks:
			for snippet in track.snippets:
				if snippet.attrs['id'] == id:
					return snippet
		else:
			raise IndexError(f'no snippet with id {id!r} exists')
	
	def as_python(self):
		title = 'program'
		header = (
			'#!/usr/bin/env python3\n\n'
			'from laszlo.engine import *\n\n'
			f'{title} = Program()\n\n'
		)
		content = '\n\n'.join(track.as_python(title) for track in self.tracks)
		footer = f'\n\n{title}.start()'
		return header + content + footer
	
	def as_dict(self):
		return {**self.attrs, 'tracks': [track.as_dict() for track in self.tracks]}
	
	def as_json(self):
		return json.dumps({'program': self.as_dict(), 'version': self.version})


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
	
	def as_dict(self):
		return {**self.attrs, 'snippets': [snippet.as_dict() for snippet in self.snippets]}


class Snippet:
	def __init__(self, attrs):
		self.attrs = attrs
	
	def parse_expr(self, expr):
		if type(expr) == ast.BinOp:
			operators = {
				ast.Add: 'add',
				ast.Sub: 'sub',
				ast.Mult: 'mul',
				ast.Div: 'div'
			}
			return {
				operators[type(expr.op)]: [
					self.parse_expr(expr.left),
					self.parse_expr(expr.right)
				]
			}
		elif type(expr) == ast.Attribute:
			return {
				'ref': {
					'id': expr.value.id,
					'prop': expr.attr
				}
			}
		elif type(expr) == ast.Name:
			return {
				'ref': {
					'id': expr.id
				}
			}
		elif type(expr) == ast.Constant:
			return expr.value
	
	def convert_attrs(self, target):
		if target == 'python':
			conversions = {
				'input': 'Input()',
				'boot': 'events.Boot()',
				'button_press': 'events.ButtonPress()'
			}
		elif target == 'json':
			conversions = {
				'input': {'stream': 'input'},
				'boot': {'event': 'boot'},
				'button_press': {'event': 'button_press'}
			}
		for attr, val in self.attrs.items():
			if not '$' in val:
				self.attrs[attr] = conversions.get(val, val)
			else:
				pythonic = val.replace('$', '')
				if target == 'python':
					self.attrs[attr] = pythonic
				elif target == 'json':
					expr = ast.parse(pythonic, mode='eval').body
					self.attrs[attr] = self.parse_expr(expr)
			
	
	def as_python(self, track_name):
		self.convert_attrs('python')
		attrs = self.attrs.copy()  # we will be removing items, so we need a deep copy
		id = attrs.pop('id')
		if 'name' in attrs:
			attrs['name'] = repr(attrs['name'])
			del attrs['name']  # TODO: allow name attributes for snippets in engine
		args = ',\n\t'.join(f'{attr} = {val}' for attr, val in attrs.items())
		output = f'{id} = {track_name}.add_snippet(\n\t{args}\n)'
		return output
	
	def as_dict(self):
		self.convert_attrs('json')
		return self.attrs


def laszlo2python(input):
	program = Program.fromYAML(input)
	return program.as_python()


def laszlo2json(input):
	program = Program.fromYAML(input)
	return program.as_json()


if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('input', nargs='?', default=sys.stdin, type=argparse.FileType('r'))
	parser.add_argument('-o', '--output', default=sys.stdout, type=argparse.FileType('w'))
	parser.add_argument('-t', '--to', default='python', metavar='format')
	args = parser.parse_args()
	if args.to == 'python':
		convert = laszlo2python
	elif args.to == 'json':
		convert = laszlo2json
	print(convert(args.input.read()), file=args.output)
