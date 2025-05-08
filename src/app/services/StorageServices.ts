import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class StorageServices {
  private lastId: number = 0; // Variable to store the last used ID

  constructor() {
    this.loadLastId();
  }

  private async loadLastId() {
    const { value } = await Preferences.get({ key: 'lastId' });
    if (value) {
      this.lastId = parseInt(value) + 1; // Parse the last ID from preferences
    } else {
      this.lastId = 1; // Default to 0 if not found
    }
    this.setLastId(this.lastId++); // Initialize the last ID in preferences
  }

  public async getLastId(): Promise<number> {
    await this.loadLastId();
    return this.lastId;
  }

  public setLastId(id: number): void {
    this.lastId = id;
    Preferences.set({ key: 'lastId', value: id.toString() });
  }

  public async save(key: string, value: any): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  public async delete(key: string) {
    await Preferences.remove({ key });
  }

  public async load<T>(key: string): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    if (value) {
      return JSON.parse(value) as T;
    } else {
      return null; // Return null if not found
    }
  }

}
