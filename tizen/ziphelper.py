import zipfile, os, sys

mode = sys.argv[1]
src_dir = sys.argv[2]
out_path = sys.argv[3]

if mode == 'unsigned':
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src_dir):
            for f in sorted(files):
                zf.write(os.path.join(root, f), os.path.relpath(os.path.join(root, f), src_dir))
elif mode == 'signed':
    sig_file = sys.argv[4]
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add all files except signature.xml first
        for root, dirs, files in os.walk(src_dir):
            for f in sorted(files):
                if f != 'signature.xml':
                    zf.write(os.path.join(root, f), os.path.relpath(os.path.join(root, f), src_dir))
        # Add signature.xml last
        zf.write(sig_file, 'signature.xml')
