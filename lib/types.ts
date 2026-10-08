/**
 * The companion JSON written to Google Drive for every recorded day.
 * Stored at:  Audio Diary / DD-MM-YYYY / entry.json
 */
export interface DiaryEntry {
  /** Date key in DD-MM-YYYY format (also the Drive folder name). */
  date: string;
  /** Unix epoch (ms) of when the recording finished. */
  timestamp: number;
  /** Whisper transcript of the recording. */
  transcript: string;
  /** Google Drive file id of the uploaded audio. */
  audioFileId: string;
  /** Original audio file name, e.g. recording_1699999999999.webm */
  audioFileName: string;
  /** Human shareable link to the audio file on Drive. */
  audioLink: string;
}
