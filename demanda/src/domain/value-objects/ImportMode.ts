export type ImportMode = 'merge' | 'replace';

export class ImportModeVO {
  private constructor(private readonly mode: ImportMode) {}

  static create(value: string): ImportModeVO {
    if (value !== 'merge' && value !== 'replace') {
      throw new Error('Invalid import mode. Must be "merge" or "replace"');
    }
    return new ImportModeVO(value as ImportMode);
  }

  get value(): ImportMode {
    return this.mode;
  }

  isMerge(): boolean {
    return this.mode === 'merge';
  }

  isReplace(): boolean {
    return this.mode === 'replace';
  }
}
