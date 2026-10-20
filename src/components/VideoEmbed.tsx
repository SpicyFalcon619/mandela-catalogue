"use client";

import { useEffect, useState } from "react";
import { PlayIcon } from "./WatchLink";

type Props = {
  /** The 11-character YouTube video id. */
  id: string;
  title: string;
  /** The video's watch page, for the credit link. */
  watchUrl: string;
  /** Channel it is on. Empty means Alex Kister's own channel. */
  channel?: string;
  compact?: boolean;
};

/**
 * The original footage, played by YouTube's own player. Nothing is copied or hosted here: the poster is the
 * thumbnail the uploader chose, loaded from YouTube, and the video itself only loads when someone presses
 * play (from youtube-nocookie.com, so no tracking cookies are set before that). The credit stays under it.
 */
export function VideoEmbed({ id, title, watchUrl, channel = "", compact = false }: Props) {
  const [playing, setPlaying] = useState(false);
  const [noPoster, setNoPoster] = useState(false);

  // Moving to another tape stops the old video and shows the new poster.
  useEffect(() => {
    setPlaying(false);
    setNoPoster(false);
  }, [id]);

  const other = channel && channel.toLowerCase() !== "alex kister" ? channel : "";
  return (
    <figure className={`vid${compact ? " compact" : ""}`}>
      <div className="vid-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={`${title} (original video on YouTube)`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="vid-poster" onClick={() => setPlaying(true)} aria-label={`Play the original video: ${title}`}>
            {!noPoster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setNoPoster(true)} />
            )}
            <span className="vid-play" aria-hidden="true">
              <PlayIcon />
            </span>
            <span className="vid-hint">Play original</span>
          </button>
        )}
      </div>
      <figcaption>
        Footage from{" "}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer">
          {title}
        </a>
        , &copy; Alex Kister, <em>The Mandela Catalogue</em>{other ? <>, on the series&apos; affiliated channel {other}</> : null}. Played from YouTube; this site does not host it.
      </figcaption>
    </figure>
  );
}
