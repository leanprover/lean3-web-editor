#!/usr/bin/env python3
import zipfile
import os, subprocess, json
from pathlib import Path

library_zip_fn = 'dist/library.zip'

os.chdir('combined_lib')
subprocess.call(['lean', '-v'])
subprocess.call(['leanpkg', 'build'])
lean_p = json.loads(subprocess.check_output(['lean', '-p']))
lean_path = [Path(p).resolve() for p in lean_p["path"]]

already_seen = set()
with zipfile.ZipFile('../' + library_zip_fn, mode='w', compression=zipfile.ZIP_DEFLATED, allowZip64=False, compresslevel=9) as zf:
    for p in lean_path:
        print(str(p))
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