/** Two updates further apart than this are a jump in the video, not playback. */
const MAX_PLAYBACK_STEP_S = 2.5;

/**
 * Seconds of a video actually played, skips left out: seeking to the end
 * does not count as watching it. Pure, fed with the player's time updates.
 */
export class WatchedSeconds {
  private seconds = new Set<number>();
  private last: number | null = null;
  private duration = 0;

  update(currentTime: number, duration: number) {
    if (duration > 0) this.duration = duration;
    const last = this.last;
    this.last = currentTime;
    if (last === null || currentTime < last || currentTime - last > MAX_PLAYBACK_STEP_S) return;
    for (let s = Math.floor(last); s < Math.floor(currentTime); s++) this.seconds.add(s);
  }

  /** The player jumped (seek, replay): the next update starts a new stretch. */
  reset() {
    this.last = null;
  }

  /** 0..1 of the video seen. */
  get ratio() {
    if (!this.duration) return 0;
    return Math.min(1, this.seconds.size / Math.max(1, Math.floor(this.duration)));
  }
}
