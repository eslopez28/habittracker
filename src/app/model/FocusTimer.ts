import { LocalNotificationSchema } from "@capacitor/local-notifications";
import { NotificationMessage } from "./NotificationMessage";

export class FocusTimer {
  id : number;
  focusDuration: number; // en minutos
  shortBreakDuration: number; // en minutos
  longBreakDuration: number; // en minutos
  intervalsPerCycle: number;
  notification?: NotificationMessage; // Optional property to store notifications

  constructor(focusDuration: number, shortBreakDuration: number, longBreakDuration: number, intervalsPerCycle: number) {
    this.id = Math.floor(Math.random() * 10000); // Generate a random ID for the timer
    this.focusDuration = focusDuration;
    this.shortBreakDuration = shortBreakDuration;
    this.longBreakDuration = longBreakDuration;
    this.intervalsPerCycle = intervalsPerCycle;
    this.notification = undefined; // Initialize notification as null
  }

}
