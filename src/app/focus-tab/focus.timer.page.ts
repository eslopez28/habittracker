import { TimerProperties } from './../model/TimerProperties';
import { FocusTimerServices } from '../services/FocusTimerServices';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular'; // Importar controladores
import { timer } from 'rxjs';

@Component({
  selector: 'app-tab1',
  templateUrl: 'focus.timer.page.html',
  styleUrls: ['focus.timer.page.scss'],
  standalone: false,
})
export class FocusTimer implements OnInit, OnDestroy {
  // --- Constructor y Ciclo de Vida ---
  // Inyecta ChangeDetectorRef para forzar actualizaciones de UI si setInterval no las detecta bien
  public timerProperties!: TimerProperties;
  public isLoading: boolean = true;
  constructor(
    private changeDetector: ChangeDetectorRef,
    private modalCtrl: ModalController, // Inyectar ModalController
    private toastCtrl: ToastController, // Inyectar ToastController
    private FocusTimerServices: FocusTimerServices
  ) { }

  async ngOnInit() {
    this.timerProperties = await this.FocusTimerServices.loadTimerProperties();

    if (this.timerProperties.isRunning) {
      if (this.timerProperties.endTime) {
        // Calcula el tiempo restante basado en la diferencia entre la hora actual y la hora de finalización
        this.timerProperties.timeLeft = Math.floor((this.timerProperties.endTime - Date.now()) / 1000);
      }

      if (this.timerProperties.timeLeft > 0) {
        this.startOrResumeTimer(); // Reinicia el temporizador
      } else {
        // Si el tiempo restante es 0 o menor, maneja el fin del intervalo
        this.handleIntervalEnd();
      }
    } else {
      // Si no estaba en ejecución, asegúrate de que el temporizador esté visible
      this.timerProperties.timerVisible = true;
    }

    this.isLoading = this.timerProperties == undefined; // Oculta el spinner de carga
  }


  async saveConfig() {
    this.FocusTimerServices.saveTimerProperties(this.timerProperties);
    this.prepareNextInterval('focus', 1);
  }

  ngOnDestroy() {
    if (!this.timerProperties.timerInterval) {
      clearInterval(this.timerProperties.timerInterval);
    }
  }


  async resetConfigToDefaults() {
    this.pauseTimer();
    this.FocusTimerServices.deleteTimerProperties(this.timerProperties);
    this.timerProperties = await this.FocusTimerServices.loadTimerProperties();
    this.prepareNextInterval('focus', 1);
  }

  // --- Métodos de Control del Temporizador ---

  startOrResumeTimer() {
    if (this.timerProperties.isRunning && !this.isLoading) {
      return;
    }

    if (this.timerProperties.currentMode === 'idle') {
      this.prepareNextInterval('focus', 1); // Asegura empezar con foco si estaba inactivo
    }

    this.timerProperties.isRunning = true;
    this.timerProperties.isPaused = false;
    this.timerProperties.timerVisible = true; // Asegura que sea visible al iniciar

    const now = Date.now();
    const endTime = now + this.timerProperties.timeLeft * 1000; // Calcula el tiempo de finalización

    this.timerProperties.endDate = new Date(endTime);
    this.timerProperties.endTime = this.timerProperties.endDate.getTime(); // Guarda el tiempo de finalización

    this.FocusTimerServices.createNotification(this.timerProperties).then(result => {
      this.timerProperties.config.notification = result;
      this.toastCtrl.create({
        message: 'Notificacion creada',
        duration: 5000,
        position: 'bottom',
      }).then(toast => toast.present());
    }).catch(err => {
      this.toastCtrl.create({
        message: 'Error al crear la notificación ' + err,
        duration: 10000,
        position: 'bottom',
      }).then(toast => toast.present());
    });

    if (!this.timerProperties.timerInterval) {
      clearInterval(this.timerProperties.timerInterval);
    }

    this.FocusTimerServices.saveTimerProperties(this.timerProperties); // Guarda el estado inicial del temporizador

    this.timerProperties.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  pauseTimer() {
    if (!this.timerProperties.isRunning) return;

    this.timerProperties.isRunning = false;
    this.timerProperties.isPaused = true;
    if (this.timerProperties.timerInterval) {
      clearInterval(this.timerProperties.timerInterval);
    }
    this.FocusTimerServices.deleteNotification(this.timerProperties);
  }

  resetTimer() {
    if (this.timerProperties.timerInterval) {
      clearInterval(this.timerProperties.timerInterval);
    }
    this.timerProperties.isRunning = false;
    this.timerProperties.isPaused = false;
    // Siempre vuelve al inicio del ciclo actual o al primer ciclo
    this.prepareNextInterval('focus', 1);
    this.timerProperties.timerVisible = true; // Asegura que sea visible
    this.FocusTimerServices.deleteNotification(this.timerProperties);
  }

  skipTimer() {
    if (this.timerProperties.timerInterval) {
      clearInterval(this.timerProperties.timerInterval);
    }
    this.timerProperties.isRunning = false; // Lo marcamos como no corriendo antes de manejar el fin
    this.timerProperties.isPaused = false;
    this.FocusTimerServices.deleteNotification(this.timerProperties);
    this.handleIntervalEnd(true); // true indica que fue un skip manual
  }

  // --- Lógica Interna del Temporizador ---

  tick() {
    if (this.timerProperties.endTime) {
      this.timerProperties.timeLeft = Math.floor((this.timerProperties.endTime - Date.now()) / 1000);
    } else {
      this.timerProperties.timeLeft = Math.floor(this.timerProperties.timeLeft - 1); // Resta un segundo

    }
    this.calculateProgress();

    if (this.timerProperties.timeLeft < 0) {
      // Llegó a cero
      this.handleIntervalEnd();
      if (this.timerProperties.timerInterval) {
        clearInterval(this.timerProperties.timerInterval); // Detiene el intervalo actual
      }
    }
    this.FocusTimerServices.saveTimerProperties(this.timerProperties);
    // Forzar detección de cambios si es necesario (a veces útil con setInterval)
    this.changeDetector.detectChanges();
  }

  handleIntervalEnd(skipped: boolean = false) {
    let nextMode: 'focus' | 'shortBreak' | 'longBreak';
    let nextIntervalNumber = this.timerProperties.currentIntervalNumber;

    if (this.timerProperties.currentMode === 'focus') {
      if (this.timerProperties.currentIntervalNumber < this.timerProperties.config.intervalsPerCycle) {
        nextMode = 'shortBreak';
        nextIntervalNumber = this.timerProperties.currentIntervalNumber + 1;
      } else {
        nextMode = 'longBreak';
        nextIntervalNumber = 1; // Reinicia para el próximo ciclo
      }
    } else if (this.timerProperties.currentMode === 'shortBreak') {
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
    this.timerProperties.isRunning = false;
    this.timerProperties.isPaused = false; // Queda listo para iniciar
  }

  prepareNextInterval(
    mode: 'focus' | 'shortBreak' | 'longBreak',
    intervalNumber: number
  ) {
    this.timerProperties.currentMode = mode;
    this.timerProperties.currentIntervalNumber = intervalNumber;

    switch (mode) {
      case 'focus':
        this.timerProperties.totalTime = this.timerProperties.config.focusDuration * 60;
        break;
      case 'shortBreak':
        this.timerProperties.totalTime = this.timerProperties.config.shortBreakDuration * 60;
        break;
      case 'longBreak':
        this.timerProperties.totalTime = this.timerProperties.config.longBreakDuration * 60;
        break;
      default:
        this.timerProperties.totalTime = this.timerProperties.config.focusDuration * 60; // Default a foco
        this.timerProperties.currentMode = 'focus';
        this.timerProperties.currentIntervalNumber = 1;
    }

    this.timerProperties.timeLeft = this.timerProperties.totalTime;
    this.updateDisplay();
    this.calculateProgress(); // Calcula progreso inicial (0 o 1)
    this.changeDetector.detectChanges();
  }

  // --- Funciones de UI ---

  updateDisplay() {
    switch (this.timerProperties.currentMode) {
      case 'focus':
        this.timerProperties.currentModeDisplay = `Enfoque ${this.timerProperties.currentIntervalNumber} / ${this.timerProperties.config.intervalsPerCycle}`;
        break;
      case 'shortBreak':
        this.timerProperties.currentModeDisplay = 'Descanso Corto';
        break;
      case 'longBreak':
        this.timerProperties.currentModeDisplay = 'Descanso Largo';
        break;
      default:
        this.timerProperties.currentModeDisplay = 'Listo para iniciar';
    }
  }

  calculateProgress() {
    if (this.timerProperties.totalTime <= 0) {
      this.timerProperties.progressPercentage = 0;
    } else {
      // Calcula el progreso como fracción de tiempo restante
      this.timerProperties.progressPercentage =
        (this.timerProperties.totalTime - this.timerProperties.timeLeft) / this.timerProperties.totalTime;
    }
  }

  formatTime(totalSeconds: number): string {
    if (totalSeconds < 0) {
      totalSeconds = 0; // Asegura que no mostremos tiempo negativo
    }
    const hours = Math.floor(totalSeconds / 3600); // Calcula las horas
    const minutes = Math.floor((totalSeconds % 3600) / 60); // Calcula los minutos restantes
    const seconds = Math.floor(totalSeconds % 60); // Calcula los segundos restantes

    // Formatea el tiempo como HH:mm:ss
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

} // Fin de la clase TimerPage
