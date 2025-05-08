import { NotificationMessage } from "../model/NotificationMessage";
import { LocalNotifications, LocalNotificationSchema, Importance } from '@capacitor/local-notifications';
import { Injectable } from '@angular/core';
import { StorageServices } from './StorageServices';

@Injectable({
  providedIn: 'root',
})
export class NotificationServices {

  private lastId!: number;
  public constructor(private storageServices: StorageServices) {
    this.storageServices.getLastId().then(id => this.lastId = id);
  }

  public async createLocalNotificationWithDefaults(title: string, body: string, schedule : any, channelName: 'Urgent' | 'Important' | 'Default' = 'Urgent'): Promise<LocalNotificationSchema> {
    return this.createLocalNotification(this.lastId, title, body, schedule, channelName);
  }

  public async createLocalNotification(id: number, title: string, body: string, schedule : any, channelName: 'Urgent' | 'Important' | 'Default' = 'Urgent'): Promise<LocalNotificationSchema> {
    const channels = await LocalNotifications.listChannels();
    const channel = channels.channels.find(r=> r.name === channelName) ?? channels.channels.find(r=> r.name === 'Urgent');
    let notification: LocalNotificationSchema = {
      id: id,
      title: `¡Tiempo Terminado!`,
      body: body,
      smallIcon: 'res://mipmap/ic_launcher',
      sound: undefined,
      silent: false,
      channelId: channel?.id,
      schedule: schedule
    };
    return notification;
  }

  public createNotification(notification: NotificationMessage): Promise<NotificationMessage> {
    return new Promise((resolve, reject) => {
      this.getPendingNotifications().then(async (pendingNotifications) => {
      const notificationId = notification.localNotification.id;
      const existingNotification = pendingNotifications.find((n) => n.id === notificationId);
      if (existingNotification) {
        // Update the existing notification
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }],
        })
      }
       await LocalNotifications.schedule({
          notifications: [notification.localNotification],
        });
    });
    });
  }

  public deleteNotification(notification: NotificationMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      LocalNotifications.cancel({
        notifications: [{ id: notification.localNotification.id }],
      }).then(() => {
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }

  private getPendingNotifications(): Promise<NotificationMessage[]> {
    return new Promise((resolve, reject) => {
      LocalNotifications.getPending().then((result) => {
        const pendingNotifications = result.notifications.map((notification) => {
          return new NotificationMessage(notification.id, notification);
        });
        resolve(pendingNotifications);
      }).catch((error) => {
        reject(error);
      });
    });
  }

}
