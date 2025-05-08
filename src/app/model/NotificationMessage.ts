import { scheduled } from 'rxjs';
import { LocalNotificationSchema } from "@capacitor/local-notifications";

export class NotificationMessage {
  id: number;
  localNotification : LocalNotificationSchema;

  constructor(id: number, localNotification: LocalNotificationSchema) {
    this.id = id;
    this.localNotification = localNotification;
  }

}
