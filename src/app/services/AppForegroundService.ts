import { Platform, ToastController } from '@ionic/angular';
import { StorageServices } from './StorageServices';
import { ForegroundService } from "@capawesome-team/capacitor-android-foreground-service";
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AppForegroundService {
  private isServiceRunning = false;

  constructor(private platform: Platform, private storageServices: StorageServices,
    private toastController: ToastController) {}

  async requestPermissions(): Promise<Boolean> {
    if (this.platform.is('capacitor')) {
      try {
        const result = await ForegroundService.requestPermissions();
        const result2 = await ForegroundService.requestManageOverlayPermission();
        await this.showToast(`Permission granted: ${result.display} and ${result2.granted}`);
        return result.display === 'granted' && result2.granted;
      } catch (err: any) {
        await this.showToast(`Error requesting permissions: ${err}`, 'danger');
        return false;
      }
    }
    return false;
  }

  async startService(): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (hasPermission && !this.isServiceRunning) {
      try {
        await ForegroundService.startForegroundService({
          title: 'Habit Tracker',
          body: 'Foreground service is running.',
          id: await this.storageServices.getLastId(),
          smallIcon: 'ic_launcher' // Default app icon
        });
        this.isServiceRunning = true;
        await this.showToast('Foreground service started.');
      } catch (err: any) {
        await this.showToast(`Error starting foreground service: ${err}`, 'danger');
      }
    }
  }

  async stopService(): Promise<void> {
    if (this.isServiceRunning) {
      try {
        await ForegroundService.stopForegroundService();
        this.isServiceRunning = false;
        await this.showToast('Foreground service stopped.');
      } catch (err: any) {
        await this.showToast(`Error stopping foreground service: ${err}`, 'danger');
      }
    }
  }

  // Método para mostrar mensajes con ToastController
  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}

