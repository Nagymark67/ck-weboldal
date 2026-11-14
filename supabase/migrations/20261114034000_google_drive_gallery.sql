ALTER TABLE gallery_images
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS source_file_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS gallery_images_source_file_id_idx
  ON gallery_images (source, source_file_id)
  WHERE source_file_id IS NOT NULL;
