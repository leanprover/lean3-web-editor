#!/usr/bin/env python3
import sys, argparse
import zipfile
import os, subprocess, json
from pathlib import Path

parser = argparse.ArgumentParser(description='Create a library.zip bundle for the lean-web-editor.')
parser.add_argument('-i', metavar='path/to/combined_lib', type=str, nargs='?',
                    help='Lean package to bundle (default: combined_lib)', default='combined_lib')
parser.add_argument('-o', metavar='path/to/library.zip', type=str, nargs='?',
                    help='output zip file (default: dist/library.zip)', default='dist/library.zip')
parser.add_argument('-c', action='store_true',
                    help='if this flag is present, only the core library will be included in the bundle')

args = parser.parse_args()
combined_lib = args.i
library_zip_fn = str(Path(args.o).resolve())

if not args.c:
    os.chdir(combined_lib)
    subprocess.call(['leanpkg', 'build'])

print('Using lean version:')
subprocess.call(['lean', '-v'])
lean_p = json.loads(subprocess.check_output(['lean', '-p']))
lean_path = [Path(p).resolve() for p in lean_p["path"]]

already_seen = set()
with zipfile.ZipFile(library_zip_fn, mode='w', compression=zipfile.ZIP_DEFLATED, allowZip64=False, compresslevel=9) as zf:
    for p in lean_path:
        # print(str(p))
        for fn in p.glob('**/*.olean'):
            rel = fn.relative_to(p)
            if '_target' in rel.parts:
                continue
            elif rel in already_seen:
                print('duplicate: {0}'.format(fn))
            else:
                zf.write(fn, arcname=str(rel))
                already_seen.add(rel)

print('Created {0} with {1} olean files'.format(library_zip_fn, len(already_seen)))
