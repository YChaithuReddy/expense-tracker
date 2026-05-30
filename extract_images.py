"""Extract images from the Biocon docx file for inspection."""
import zipfile
import os
import shutil

src = r'C:\Users\chath\Downloads\Biocon Clampon Consolidated Calibration Certificate.docx'
out_dir = r'C:\Users\chath\Documents\Python code\expense tracker\biocon_images'

os.makedirs(out_dir, exist_ok=True)

with zipfile.ZipFile(src, 'r') as z:
    media_files = [f for f in z.namelist() if f.startswith('word/media/')]
    print(f'Found {len(media_files)} media files:')
    for mf in media_files:
        print(f'  {mf}')
        with z.open(mf) as src_file:
            target = os.path.join(out_dir, os.path.basename(mf))
            with open(target, 'wb') as dst_file:
                shutil.copyfileobj(src_file, dst_file)

print(f'\nExtracted to: {out_dir}')
