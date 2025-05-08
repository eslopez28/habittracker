import { scheduled, timer } from 'rxjs';
import { TimerProperties } from "../model/TimerProperties";
import { FocusTimer } from "../model/FocusTimer";
import { StorageServices } from "./StorageServices";
import { NotificationServices } from "./NotificationServices";
import { NotificationMessage } from '../model/NotificationMessage';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FocusTimerServices {

  private TIMER_PROPERTIES_KEY = 'timerProperties'; // Key for storing timer properties in preferences
  constructor(private storageService: StorageServices,
    private notificationService: NotificationServices) { // Inject the storage service and notification service
    this.notificationService = notificationService; // Initialize the notification service
    this.storageService = storageService; // Initialize the storage service
  }

  private async createDefaultTimerProperties(): Promise<TimerProperties> {
    return await this.storageService.getLastId().then(
      id => {
        const timerProperties = new TimerProperties();  // Create a new instance of TimerProperties
        timerProperties.config = new FocusTimer(25, 5, 15, 4); // Set default focus timer configuration
        timerProperties.config.id = id; // Generate a random ID for the timer
        timerProperties.currentMode = 'idle'; // Set current mode to idle
        timerProperties.currentIntervalNumber = 1; // Set current interval number to 1
        timerProperties.isRunning = false; // Set isRunning to false
        timerProperties.isPaused = false; // Set isPaused to false
        timerProperties.isFinished = false; // Set isFinished to false
        timerProperties.timerVisible = true;
        timerProperties.currentModeDisplay = `Enfoque ${timerProperties.currentIntervalNumber} / ${timerProperties.config.intervalsPerCycle}`;
        return timerProperties; // Return the created TimerProperties instance
      }
    ); // Get the last ID from storage service
  }

  private async createDetailedNotificationMessage(timerProperties: TimerProperties): Promise<NotificationMessage> {
    if(timerProperties.config.notification) this.deleteNotification(timerProperties);
    const notificationId = await this.storageService.getLastId(); // Get the last ID from storage service
    return new NotificationMessage(
      notificationId, // Use the last ID as the notification ID
      await this.notificationService.createLocalNotification(
              notificationId, // Use the last ID as the notification ID
              'Tiempo terminado!',
              this.determineNotificationBody(timerProperties.currentMode),
              { at: timerProperties.endDate, allowWhileIdle: true }, 'Urgent'
            )
    );
  }

  determineNotificationBody(state: String): string {
    switch (state) {
      case 'focus':
        return 'Intervalo de enfoque completado. ¡Toma un descanso!';
      case 'shortBreak':
        return 'Descanso corto terminado. ¡Hora de enfocarse!';
      case 'longBreak':
        return 'Descanso largo terminado. ¿Listo para el siguiente ciclo?';
      default:
        return 'Intervalo completado.';
    }
  }

  async loadTimerProperties(): Promise<TimerProperties> {
    const value = await this.storageService.load(this.TIMER_PROPERTIES_KEY); // Load timer properties from preferences
    if (value) {
      return value as TimerProperties;
    } else {
      return this.createDefaultTimerProperties();
    }
  }

  async saveTimerProperties(timerProperties: TimerProperties): Promise<void> {
    await this.storageService.save(this.TIMER_PROPERTIES_KEY, timerProperties); // Save timer properties to preferences
  }

  async delete(): Promise<void> {
    await this.storageService.delete(this.TIMER_PROPERTIES_KEY); // Delete timer properties from preferences
  }

  async createNotification(timerProperties: TimerProperties): Promise<NotificationMessage> {
    if(timerProperties.config.notification) {
      this.deleteNotification(timerProperties);
    }
    const newNotification = await this.createDetailedNotificationMessage(timerProperties); // Create a detailed notification message
    timerProperties.config.notification = newNotification; // Assign the notification to the timer properties
    this.saveTimerProperties(timerProperties); // Save the timer properties with the new notification
    return await this.notificationService.createNotification(newNotification); // Create the notification using the notification service
  }

  async deleteNotification(timerProperties: TimerProperties): Promise<void> {
    const notification = timerProperties.config.notification; // Get the notification from the timer properties
    if (notification) {
      await this.notificationService.deleteNotification(notification); // Delete the notification using the notification service
    }
    timerProperties.config.notification = undefined;
    this.saveTimerProperties(timerProperties);
  }

  public deleteTimerProperties(TimerProperties: TimerProperties) {
    this.deleteNotification(TimerProperties);
    this.delete();
  }

}
