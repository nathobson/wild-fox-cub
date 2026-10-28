import { thumbUrl, type MediaItem } from '../../lib/media';
import { useMedia } from '../../store/MediaStore';

/** Thumbnail URL for an uploaded image, or null if it isn't in the library. */
export function useMediaThumb() {
  const { items } = useMedia();
  return (mediaId?: string | null) => {
    const item = mediaId ? items.find((i) => i.id === mediaId) : undefined;
    return item ? thumbUrl(item) : null;
  };
}

interface MediaFieldProps {
  mediaId: string | null | undefined;
  onChange: (item: MediaItem) => void;
  /** Remove button; omit for required images. */
  onClear?: () => void;
}

/** Inspector control: preview plus choose / replace (and optionally remove). */
export function MediaField({ mediaId, onChange, onClear }: MediaFieldProps) {
  const { pick } = useMedia();
  const thumb = useMediaThumb()(mediaId);

  const choose = async () => {
    const item = await pick();
    if (item) onChange(item);
  };

  return (
    <div className="img-list">
      {thumb && <img className="insp-preview" src={thumb} alt="" />}
      <button className="wide-btn" onClick={choose}>
        {mediaId ? 'Replace image' : 'Choose image'}
      </button>
      {mediaId && onClear && (
        <button className="wide-btn" onClick={onClear}>
          Remove image
        </button>
      )}
    </div>
  );
}
