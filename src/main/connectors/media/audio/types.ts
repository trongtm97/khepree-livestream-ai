/**
 * Local audio sink. V1 = speakers; VirtualAudioOutput comes later.
 */
export interface AudioOutput {
  readonly id: string;
  play(filePath: string): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
