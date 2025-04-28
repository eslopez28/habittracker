import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { ModalController, ToastController } from '@ionic/angular'; // Importar controladores
import { timer } from 'rxjs';

// --- Interfaz y Constantes ---
interface TimerConfig {
  focusDuration: number; // en minutos
  shortBreakDuration: number; // en minutos
  longBreakDuration: number; // en minutos
  intervalsPerCycle: number;
  notifications?: LocalNotificationSchema[]; // Optional property to store notifications
}

const DEFAULT_CONFIG: TimerConfig = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  intervalsPerCycle: 4,
};

const CONFIG_STORAGE_KEY = 'timerConfig';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, OnDestroy {
  // --- Propiedades para la Configuración ---
  config: TimerConfig = { ...DEFAULT_CONFIG };

  // --- Propiedades de Estado del Temporizador ---
  timerInterval: any = null;
  timeLeft: number = 0; // en segundos
  totalTime: number = 0; // en segundos
  currentMode: 'focus' | 'shortBreak' | 'longBreak' | 'idle' = 'idle';
  currentIntervalNumber: number = 1; // # de intervalo de enfoque actual
  isRunning: boolean = false;
  isPaused: boolean = false;

  // --- Propiedades para la UI ---
  timerVisible: boolean = false; // Para mostrar/ocultar el contenedor del timer
  currentModeDisplay: string = 'Configura y guarda para iniciar';
  progressPercentage: number = 0;

  // --- Constructor y Ciclo de Vida ---
  // Inyecta ChangeDetectorRef para forzar actualizaciones de UI si setInterval no las detecta bien
  constructor(
    private changeDetector: ChangeDetectorRef,
    private modalCtrl: ModalController, // Inyectar ModalController
    private toastCtrl: ToastController // Inyectar ToastController
  ) {}

  async ngOnInit() {
    console.log('TimerPage OnInit');
    // Verificar si hay un estado guardado del temporizador
    const timerState = await Preferences.get({ key: 'timerState' }).then(
      (res) => JSON.parse(res.value || '{}')
    );

    if (timerState) {
      if (timerState.isRunning) {
        const now = Date.now();
        const timeLeft = Math.max(
          0,
          Math.floor((timerState.endTime - now) / 1000)
        ); // Calcula el tiempo restante
        this.config = timerState.config; // Cargar configuración guardada si existe
        this.timerVisible = true;
        this.currentMode = timerState.currentMode;
        this.currentIntervalNumber = timerState.currentIntervalNumber;
        this.timeLeft = timeLeft;
        this.totalTime = timerState.timeLeft;
        if (timeLeft > 0) {
          console.log(
            `Restaurando temporizador: Modo ${this.currentMode}, Intervalo ${this.currentIntervalNumber}, Tiempo restante: ${this.timeLeft}s`
          );
          this.startOrResumeTimer(); // Reinicia el temporizador
        } else {
          console.log('El temporizador expiró mientras la app estaba cerrada.');
          this.timerVisible = true; // Oculta el temporizador
          this.handleIntervalEnd(false); // Reinicia el temporizador
          await Preferences.remove({ key: 'timerState' }); // Limpia el estado guardado
        }
      } else {
        console.log('El temporizador no estaba corriendo.');
        this.prepareNextInterval('focus', 1); // Prepara para el primer inicio
        this.timerVisible = true; // Asegura que sea visible
      }
    } else {
      this.prepareNextInterval('focus', 1); // Prepara para el primer inicio
      this.timerVisible = true;
    }
  }

  ngOnDestroy() {
    // Asegúrate de limpiar el intervalo si el usuario navega fuera de la página
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // --- Métodos de Configuración ---

  async loadConfig() {
    try {
      const result = await Preferences.get({ key: CONFIG_STORAGE_KEY });
      if (result.value) {
        const loadedConfig = JSON.parse(result.value);
        // Validar que los números sean válidos (mayores que 0)
        this.config = {
          focusDuration: Math.max(
            1,
            loadedConfig.focusDuration || DEFAULT_CONFIG.focusDuration
          ),
          shortBreakDuration: Math.max(
            1,
            loadedConfig.shortBreakDuration || DEFAULT_CONFIG.shortBreakDuration
          ),
          longBreakDuration: Math.max(
            1,
            loadedConfig.longBreakDuration || DEFAULT_CONFIG.longBreakDuration
          ),
          intervalsPerCycle: Math.max(
            1,
            loadedConfig.intervalsPerCycle || DEFAULT_CONFIG.intervalsPerCycle
          ),
          notifications: loadedConfig.notifications || [], // Cargar notificaciones si existen
        };
        console.log('Configuración cargada:', this.config);
      } else {
        this.config = { ...DEFAULT_CONFIG };
        console.log('Usando configuración por defecto.');
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      this.config = { ...DEFAULT_CONFIG }; // Fallback a defaults
    }
    // Si el timer no está corriendo, actualizar el estado inicial
    if (!this.isRunning && !this.isPaused) {
      this.prepareNextInterval('focus', 1);
    }
  }

  async saveConfig() {
    try {
      // Validar antes de guardar
      this.config = {
        focusDuration: Math.max(1, this.config.focusDuration),
        shortBreakDuration: Math.max(1, this.config.shortBreakDuration),
        longBreakDuration: Math.max(1, this.config.longBreakDuration),
        intervalsPerCycle: Math.max(1, this.config.intervalsPerCycle),
      };
      await Preferences.set({
        key: CONFIG_STORAGE_KEY,
        value: JSON.stringify(this.config),
      });
      console.log('Configuración guardada:', this.config);
      // Hacer visible y preparar el timer si estaba oculto
      if (!this.timerVisible || (!this.isRunning && !this.isPaused)) {
        this.prepareNextInterval('focus', 1);
        this.timerVisible = true;
      }
      Preferences.remove({ key: 'timerState' }).then(() => {
        console.log('Estado del temporizador eliminado.');
      });
      // Opcional: Mostrar un Toast de confirmación
      // const toast = await this.toastController.create({ message: 'Configuración guardada', duration: 1500 });
      // toast.present();
      LocalNotifications.cancel({
        notifications: this.config.notifications || [],
      }).then(() => {
        console.log('Notificaciones canceladas al saltar el temporizador.');
      });
      this.config.notifications = []; // Limpia la lista de notificaciones
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      // Opcional: Mostrar Toast de error
    }
  }

  resetConfigToDefaults() {
    this.config = { ...DEFAULT_CONFIG };
    console.log('Configuración restaurada a predeterminados.');
    // No guardamos automáticamente, el usuario debe pulsar guardar si quiere persistir los defaults
    if (!this.isRunning && !this.isPaused) {
      this.prepareNextInterval('focus', 1);
    }
    Preferences.remove({ key: 'timerState' }).then(() => {
      console.log('Estado del temporizador eliminado.');
    });
    this.config.notifications?.forEach((notification) => {
      LocalNotifications.cancel({ notifications: [notification] })
        .then(() => {
          console.log('Notificación cancelada:', notification.id);
        })
        .catch((error) => {
          console.error('Error al cancelar notificación:', error);
        });
    });
    this.config.notifications = []; // Limpia la lista de notificaciones
  }

  // --- Métodos de Control del Temporizador ---

  startOrResumeTimer() {
    if (this.isRunning) return; // Ya está corriendo

    if (this.currentMode === 'idle') {
      this.prepareNextInterval('focus', 1); // Asegura empezar con foco si estaba inactivo
    }

    this.isRunning = true;
    this.isPaused = false;
    this.timerVisible = true; // Asegura que sea visible al iniciar

    // Limpia intervalo anterior por si acaso
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Guardar el tiempo de inicio y finalización
    const now = Date.now();
    const endTime = now + this.timeLeft * 1000; // Calcula el tiempo de finalización
    Preferences.set({
      key: 'timerState',
      value: JSON.stringify({
        isRunning: true,
        startTime: now,
        endTime: endTime,
        currentMode: this.currentMode,
        currentIntervalNumber: this.currentIntervalNumber,
        timeLeft: this.timeLeft,
        config: this.config, // Guarda la configuración actual
      }),
    });

    console.log(
      `Iniciando/Reanudando modo: ${this.currentMode}, Intervalo: ${this.currentIntervalNumber}, Tiempo: ${this.timeLeft}s`
    );

    this.sendNotification({
      at: new Date(Date.now() + this.timeLeft * 1000),
    });

    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  pauseTimer() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.isPaused = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Cancelar notificaciones pendientes
    LocalNotifications.cancel({
      notifications: this.config.notifications || [],
    }).then(() => {
      console.log('Notificaciones canceladas al saltar el temporizador.');
    });
    this.config.notifications = []; // Limpia la lista de notificaciones
    console.log('Temporizador pausado');
  }

  resetTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.isRunning = false;
    this.isPaused = false;
    // Siempre vuelve al inicio del ciclo actual o al primer ciclo
    this.prepareNextInterval('focus', 1);
    this.timerVisible = true; // Asegura que sea visible
    // Cancelar notificaciones pendientes
    LocalNotifications.cancel({
      notifications: this.config.notifications || [],
    }).then(() => {
      console.log('Notificaciones canceladas al saltar el temporizador.');
    });
    this.config.notifications = []; // Limpia la lista de notificaciones
    console.log('Temporizador reiniciado');
  }

  skipTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.isRunning = false; // Lo marcamos como no corriendo antes de manejar el fin
    this.isPaused = false;
    console.log('Saltando intervalo actual:', this.currentMode);
    // Cancelar notificaciones pendientes
    LocalNotifications.cancel({
      notifications: this.config.notifications || [],
    }).then(() => {
      console.log('Notificaciones canceladas al saltar el temporizador.');
    });
    this.config.notifications = []; // Limpia la lista de notificaciones
    this.handleIntervalEnd(true); // true indica que fue un skip manual
  }

  // --- Lógica Interna del Temporizador ---

  tick() {
    this.timeLeft--;
    this.calculateProgress();

    if (this.timeLeft < 0) {
      // Llegó a cero
      this.handleIntervalEnd();
      if (this.timerInterval) {
        clearInterval(this.timerInterval); // Detiene el intervalo actual
      }
    }
    // Forzar detección de cambios si es necesario (a veces útil con setInterval)
    this.changeDetector.detectChanges();
  }

  handleIntervalEnd(skipped: boolean = false) {
    if (!skipped) {
      console.log(`Fin de intervalo: ${this.currentMode}`);
      this.playNotificationSound(); // Opcional: Notificar al usuario
    }

    let nextMode: 'focus' | 'shortBreak' | 'longBreak';
    let nextIntervalNumber = this.currentIntervalNumber;

    if (this.currentMode === 'focus') {
      if (this.currentIntervalNumber < this.config.intervalsPerCycle) {
        nextMode = 'shortBreak';
        nextIntervalNumber = this.currentIntervalNumber + 1;
      } else {
        nextMode = 'longBreak';
        nextIntervalNumber = 1; // Reinicia para el próximo ciclo
      }
    } else if (this.currentMode === 'shortBreak') {
      nextMode = 'focus';
      // nextIntervalNumber no cambia aquí, ya se incrementó al pasar a shortBreak
    } else {
      // Era 'longBreak' o 'idle'
      nextMode = 'focus';
      nextIntervalNumber = 1;
    }

    this.prepareNextInterval(nextMode, nextIntervalNumber);

    // Opcional: Iniciar automáticamente el siguiente intervalo
    // this.startOrResumeTimer();
    // O dejarlo en estado 'idle' para que el usuario inicie manualmente
    this.isRunning = false;
    this.isPaused = false; // Queda listo para iniciar
  }

  prepareNextInterval(
    mode: 'focus' | 'shortBreak' | 'longBreak',
    intervalNumber: number
  ) {
    this.currentMode = mode;
    this.currentIntervalNumber = intervalNumber;

    switch (mode) {
      case 'focus':
        this.totalTime = this.config.focusDuration * 60;
        break;
      case 'shortBreak':
        this.totalTime = this.config.shortBreakDuration * 60;
        break;
      case 'longBreak':
        this.totalTime = this.config.longBreakDuration * 60;
        break;
      default:
        this.totalTime = this.config.focusDuration * 60; // Default a foco
        this.currentMode = 'focus';
        this.currentIntervalNumber = 1;
    }

    this.timeLeft = this.totalTime;
    this.updateDisplay();
    this.calculateProgress(); // Calcula progreso inicial (0 o 1)
    console.log(
      `Preparado para: ${this.currentMode}, Intervalo: ${this.currentIntervalNumber}, Tiempo: ${this.timeLeft}s`
    );

    // Forzar detección de cambios
    this.changeDetector.detectChanges();
  }

  // --- Funciones de UI ---

  updateDisplay() {
    switch (this.currentMode) {
      case 'focus':
        this.currentModeDisplay = `Enfoque ${this.currentIntervalNumber} / ${this.config.intervalsPerCycle}`;
        break;
      case 'shortBreak':
        this.currentModeDisplay = 'Descanso Corto';
        break;
      case 'longBreak':
        this.currentModeDisplay = 'Descanso Largo';
        break;
      default:
        this.currentModeDisplay = 'Listo para iniciar';
    }
  }

  calculateProgress() {
    if (this.totalTime <= 0) {
      this.progressPercentage = 0;
    } else {
      // Calcula el progreso como fracción de tiempo restante
      this.progressPercentage =
        (this.totalTime - this.timeLeft) / this.totalTime;
    }
  }

  formatTime(totalSeconds: number): string {
    if (totalSeconds < 0) {
      totalSeconds = 0; // Asegura que no mostremos tiempo negativo
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60); // Usar Math.floor por si acaso

    // La línea clave es esta: Usa backticks (`) para template literals
    // y ${...} para insertar las variables formateadas.
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  async sendNotification(schedule: any = {}) {
    // --- Programar Notificación ---
    try {
      // ... (tu lógica para determinar el siguiente estado) ...
      const notificationId = this.currentIntervalNumber;
      const pendingNotifications = await LocalNotifications.getPending();
      const notificationExists = pendingNotifications.notifications.some(
        (n) => n.id === notificationId
      );

      if (notificationExists) {
        console.log(`La notificación ya existe. No se programará nuevamente.`);
        return; // Salir si la notificación ya está programada
      }

      // Define la notificación
      const notification: LocalNotificationSchema = {
        id: notificationId, // ID único (timestamp simple funciona para notificaciones inmediatas)
        title: `¡Tiempo Terminado!`,
        body: this.determineNotificationBody(), // Mensaje personalizado según el modo
        // schedule: { at: new Date(Date.now() + 100) } // Programar para casi inmediato
        // O simplemente enviar sin 'schedule' para mostrar ya (depende versión plugin)
        smallIcon: 'res://mipmap/ic_launcher', // Usa el icono por defecto de la app (Android)
        sound: undefined, // Usa el sonido por defecto del sistema
        schedule: schedule,
      };

      console.log('Programando notificación:', notification.id);
      let toast = await LocalNotifications.schedule({
        notifications: [notification],
      })
        .then(() => {
          return this.toastCtrl.create({
            message: `Notificacion ${
              notification.body
            } lista para ${this.formatTime(this.totalTime)}`,
            duration: 2000,
            color: 'success',
          });
        })
        .catch((error) => {
          return this.toastCtrl.create({
            message: 'Error al enviar la notificacion: ' + error,
            duration: 5000,
            color: 'danger',
          });
        });

      if (toast) {
        await toast.present();
      }

      if (this.config.notifications) {
        this.config.notifications.push(notification);
      } else {
        this.config.notifications = [notification]; // Inicializa la lista si no existe
      }
      await Preferences.set({
        key: CONFIG_STORAGE_KEY,
        value: JSON.stringify(this.config),
      });
    } catch (e) {
      this.toastCtrl
        .create({
          message: 'Error al enviar la notificacion: ' + e,
          duration: 5000,
          color: 'danger',
        })
        .then((toast) => {
          toast.present();
        });
      console.error('Error al programar la notificación:', e);
    }
    // --- Fin Programar Notificación ---

    // ... (resto de tu lógica para preparar/iniciar el siguiente intervalo) ...
  }

  // Función helper para el cuerpo de la notificación
  determineNotificationBody(): string {
    if (!this.currentMode) return 'Es hora de continuar.'; // Fallback genérico

    const state = this.currentMode;

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

  // --- Funciones Auxiliares ---

  playNotificationSound() {
    // Implementa aquí la lógica para reproducir un sonido
    console.log(' Reproducir sonido de notificación ');
    // Ejemplo con NativeAudio (requiere instalación y configuración)
    /*
    NativeAudio.play({ assetId: 'notificationSound' }).catch(err => {
      console.error('Error al reproducir sonido:', err);
      // Podrías usar un fallback con <audio> HTML5 si falla
    });
    */
  }

  // Opcional: Pre-cargar sonido para NativeAudio
  /*
  async preloadSound() {
    try {
      await NativeAudio.preload({
        assetId: 'notificationSound',
        assetPath: 'assets/audio/notification.mp3', // Asegúrate que la ruta es correcta
        audioChannelNum: 1,
        isUrl: false
      });
      console.log('Sonido precargado');
    } catch (err) {
      console.error('Error al precargar sonido:', err);
    }
  }
  */
} // Fin de la clase TimerPage
