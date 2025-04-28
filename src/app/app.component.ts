import { Component, OnInit } from '@angular/core';

import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular'; // Para detectar la plataforma

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
  constructor(private platform: Platform) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      console.log('Plataforma lista');
    });
    Preferences.get({ key: 'appConfig' }).then((result) => {
      if(!result.value) {
        Preferences.set({ key: 'appConfig', value: JSON.stringify({
          firstExecutionDate: new Date()
        })});
      }
    });
  }

  async requestNotificationPermission() {
    // Los permisos solo se piden realmente en móvil nativo
    if (this.platform.is('capacitor')) {
      try {
        const permissionStatus = await LocalNotifications.requestPermissions();
        if (permissionStatus.display === 'granted') {
          console.log('Permiso de notificación concedido.');
        } else {
          console.warn('Permiso de notificación NO concedido.');
          // Podrías mostrar un mensaje al usuario explicando por qué son útiles
        }
      } catch (e) {
        console.error('Error solicitando permiso de notificación:', e);
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
    await this.requestNotificationPermission();
    // ... resto de ngOnInit ...
  }
}
