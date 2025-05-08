import { Component, OnInit, NgZone } from '@angular/core';

import { Channel, Importance, LocalNotifications } from '@capacitor/local-notifications';
import { Platform, ToastController } from '@ionic/angular'; // Para detectar la plataforma
import { StorageServices } from './services/StorageServices';
import { AppForegroundService } from './services/AppForegroundService';

interface AppSettings {
  firstExecutionDate: Date;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private platform: Platform, private storageServices: StorageServices,
    private readonly ngZone: NgZone, private foregroundService: AppForegroundService,
    private toastController: ToastController) {
    this.initializeApp();
  }
  async initializeApp() {
    this.platform.ready().then(async () => {
      console.log('Plataforma lista');
      await this.ngOnInit();
      this.storageServices.load('appConfig').then(r => {
        if (r && typeof r === 'object' && 'firstExecutionDate' in r && !r.firstExecutionDate) {
          this.storageServices.save('appConfig', {fistExecutionDate: new Date()})
        }
      });
      this.createNotificationChannel('Urgent', 5).then(c => console.log('Canal creado')).catch(err=> this.showToast(err, 'danger'));
      this.createNotificationChannel('Important', 4).then(c=> console.log('Canal creado')).catch(err=> this.showToast(err, 'danger'));
      this.createNotificationChannel('Default', 3).then(c=> console.log('Canal creado')).catch(err=> this.showToast(err, 'danger'));
    });
  }
  private async createNotificationChannel(channelName: string, importance: Importance = 5) {
    this.storageServices.getLastId().then(id => {
      const channel: Channel = {
        id: id.toString(),
        name: channelName,
        importance: importance, // Max importance for high-priority notifications
        visibility: 1, // Public visibility
        sound: undefined, // Default system sound
      }
      return LocalNotifications.createChannel(channel);
    });
  }

  async requestNotificationPermission() {
    // Los permisos solo se piden realmente en móvil nativo
    if (this.platform.is('capacitor')) {
      try {
        const permissionStatus = await LocalNotifications.requestPermissions();
        if (permissionStatus.display === 'granted') {
          this.showToast('Permiso de notificación concedido.');
        } else {
          this.showToast('Permiso de notificación NO concedido.', 'warning');
          // Podrías mostrar un mensaje al usuario explicando por qué son útiles
        }
      } catch (e) {
        this.showToast('Error solicitando permiso de notificación: ' + e, 'danger');
      }
    } else {
      console.log(
        'Permisos de notificación no aplicables en web (generalmente).'
      );
      // En web, los permisos se manejan diferente (Notifications API del navegador)
      // El plugin local no los gestiona igual en web.
    }
  }

  async ngOnInit() {
    try {
      await this.requestNotificationPermission();
      await this.foregroundService.startService();
    } catch (ex: any) {
      this.showToast(ex, 'danger');
    }
    // ... resto de ngOnInit ...
  }

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
