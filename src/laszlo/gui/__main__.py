from . import open_editor, open_multiple_editors
import argparse

def main():
	parser = argparse.ArgumentParser()
	parser.add_argument('input', nargs='*', default=None, type=argparse.FileType('r'))
	parser.add_argument('--exec', help=argparse.SUPPRESS)
	parser.add_argument('--version', action='version', version='0.1.0')
	args = parser.parse_args()
	if args.exec:
		exec(args.exec)
	elif args.input:
		open_multiple_editors(args.input)
	else:
		open_editor()

if __name__ == '__main__':
	main()
