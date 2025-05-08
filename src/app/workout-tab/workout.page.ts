import { waitForAsync } from '@angular/core/testing';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
// Nota: No estamos importando Preferences ni NativeAudio en esta versión base
// Si necesitas guardar/cargar configuraciones o sonidos, tendrás que añadirlos después.
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { ModalController, ToastController } from '@ionic/angular';
import { scheduled } from 'rxjs';
import { NotificationServices } from '../services/NotificationServices';
import { NotificationMessage } from '../model/NotificationMessage';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

// --- Interfaces para Configuración ---
interface SingleSetConfig {
  exerciseName: string;
  sets: number;
  reps: number;
  restTime: number; // segundos
}

interface SuperSetExercise {
  name: string;
  reps: number;
}

interface SuperSetConfig {
  sets: number;
  intraSetRestTime: number; // segundos (entre ejercicios)
  interSetRestTime: number; // segundos (entre series completas)
  exercises: SuperSetExercise[];
}

interface TimedSetConfig {
  exerciseName: string;
  duration: number; // segundos
  sets: number;
  restTime: number; // segundos (si sets > 1)
}

// --- Interfaz para el Estado del Workout Activo ---
// Asegúrate de que todas las propiedades usadas en el HTML estén aquí
interface WorkoutState {
  workoutType: 'single' | 'super' | 'timed';
  workoutTypeDisplay: string;
  mode:
    | 'exercise_reps'
    | 'exercise_timed'
    | 'rest'
    | 'intra_set_rest'
    | 'finished';
  totalSets: number;
  currentSet: number;
  currentExerciseIndex: number; // Índice para super series (o 0 para otros)
  currentExerciseName: string;
  currentTargetReps?: number; // Opcional: solo para 'exercise_reps'
  timeLeft?: number; // Opcional: solo para 'exercise_timed', 'rest', 'intra_set_rest'
  totalTime?: number; // Opcional: solo para modos con tiempo
  progressPercentage?: number; // Opcional: solo para modos con tiempo
  showNextExerciseButton?: boolean; // Opcional: solo para super series
  // Guarda una copia de la configuración original para referencia fácil
  originalConfig: SingleSetConfig | SuperSetConfig | TimedSetConfig;
  notifications?: LocalNotificationSchema[]; // Opcional: para almacenar notificaciones programadas
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'workout.page.html',
  styleUrls: ['workout.page.scss'],
  standalone: false,
})
export class WorkoutPage implements OnInit, OnDestroy {
  // --- Propiedades para la Configuración (vinculadas al HTML con [(ngModel)]) ---
  selectedWorkoutType: 'single' | 'super' | 'timed' = 'single';
  singleSetConfig: SingleSetConfig = {
    exerciseName: '',
    sets: 3,
    reps: 10,
    restTime: 60,
  };
  superSetConfig: SuperSetConfig = {
    sets: 3,
    intraSetRestTime: 10,
    interSetRestTime: 90,
    exercises: [
      { name: '', reps: 10 },
      { name: '', reps: 10 },
    ], // Inicia con 2 ejercicios
  };
  timedSetConfig: TimedSetConfig = {
    exerciseName: '',
    duration: 30,
    sets: 1,
    restTime: 0,
  };

  // --- Propiedades de Estado ---
  isWorkoutActive: boolean = false; // Controla qué sección del HTML se muestra
  workoutState: WorkoutState | null = null; // Contiene el estado detallado del workout activo
  timerInterval: any = null; // Referencia para el setInterval del timer

  // --- Constructor y Ciclo de Vida ---
  constructor(
    private changeDetector: ChangeDetectorRef,
    private modalCtrl: ModalController, // Inyectar ModalController
    private toastCtrl: ToastController,
    private notificationServices : NotificationServices
  ) {} // Inyectar ToastController

  async ngOnInit() {
    console.log('WorkoutPage inicializada.');

    // Verificar si hay un estado guardado del timer
    const timerState = await Preferences.get({ key: 'workoutTimerState' }).then(
      (res) => JSON.parse(res.value || '{}')
    );

    if (timerState) {
      if (timerState.isRunning) {
        const now = Date.now();
        const timeLeft = Math.max(
          0,
          Math.floor((timerState.endTime - now) / 1000)
        ); // Calcula el tiempo restante

        this.workoutState = timerState.workoutState;
        if (this.workoutState) {
          this.workoutState.timeLeft = timeLeft;
          this.workoutState.totalTime = timerState.workoutState.totalTime;
          this.workoutState.progressPercentage = 0;

          console.log(
            `Restaurando timer: Modo ${this.workoutState.mode}, Tiempo restante: ${timeLeft}s`
          );
          if (timeLeft > 0) {
            this.startTimer(timeLeft, this.workoutState.mode); // Reanuda el timer
          } else {
            this.moveToNextState;
          }
        } else {
          console.log('El timer expiró mientras la app estaba cerrada.');
          this.endWorkout(); // Termina el workout si no hay estado válido
        }
      }
    }
    // Aquí podrías añadir lógica para cargar una configuración guardada si la implementas
  }

  ngOnDestroy() {
    // Limpia el temporizador si el usuario sale de la página
    this.clearTimerInterval();
    console.log('WorkoutPage destruida.');
  }

  // --- Métodos del Formulario de Configuración ---

  // Se llama cuando el usuario cambia el segmento
  onWorkoutTypeChange() {
    console.log('Tipo de workout seleccionado:', this.selectedWorkoutType);
    // Opcional: Resetear formularios no seleccionados si quieres una interfaz más limpia
    // if (this.selectedWorkoutType !== 'single') { this.singleSetConfig = { ... }; }
    // if (this.selectedWorkoutType !== 'super') { this.superSetConfig = { ... }; }
    // if (this.selectedWorkoutType !== 'timed') { this.timedSetConfig = { ... }; }
  }

  // Añade un campo para ejercicio en la super serie
  addSuperSetExercise() {
      this.superSetConfig.exercises.push({ name: '', reps: 10 });
  }

  // Elimina un ejercicio de la super serie
  removeSuperSetExercise(index: number) {
    this.superSetConfig.exercises.splice(index, 1);
  }

  // Verifica si el formulario activo es válido para iniciar
  canStartWorkout(): boolean {
    try {
      switch (this.selectedWorkoutType) {
        case 'single':
          return (
            !!this.singleSetConfig.exerciseName?.trim() &&
            this.singleSetConfig.sets >= 1 &&
            this.singleSetConfig.reps >= 1 &&
            this.singleSetConfig.restTime >= 0
          );
        case 'super':
          if (
            this.superSetConfig.sets < 1 ||
            this.superSetConfig.intraSetRestTime < 0 ||
            this.superSetConfig.interSetRestTime < 0 ||
            this.superSetConfig.exercises.length < 2
          ) {
            return false;
          }
          // Verifica que todos los ejercicios tengan nombre y reps > 0
          return this.superSetConfig.exercises.every(
            (ex) => !!ex.name?.trim() && ex.reps >= 1
          );
        case 'timed':
          // Asegura que sets y restTime tengan valor si no se rellenan
          const sets = this.timedSetConfig.sets || 1;
          const restTime = this.timedSetConfig.restTime || 0;
          return (
            !!this.timedSetConfig.exerciseName?.trim() &&
            this.timedSetConfig.duration >= 1 &&
            sets >= 1 &&
            restTime >= 0
          );
        default:
          return false;
      }
    } catch (e) {
      console.error('Error validando formulario:', e);
      return false; // Si hay error en validación, no se puede iniciar
    }
  }

  // --- Métodos de Control Principal del Workout ---

  startWorkout() {
    if (!this.canStartWorkout()) {
      console.warn('Intento de iniciar workout inválido.');
      // Aquí podrías mostrar una alerta al usuario
      return;
    }

    let initialMode: WorkoutState['mode'];
    let initialStateProps: Partial<WorkoutState> = {}; // Usamos Partial para construir el estado

    // Copia profunda de la configuración relevante para guardarla en el estado
    let originalConfigCopy: any;

    switch (this.selectedWorkoutType) {
      case 'single':
        originalConfigCopy = { ...this.singleSetConfig };
        initialMode = 'exercise_reps';
        initialStateProps = {
          workoutTypeDisplay: 'Serie Simple',
          totalSets: originalConfigCopy.sets,
          currentExerciseName: originalConfigCopy.exerciseName,
          currentTargetReps: originalConfigCopy.reps,
          showNextExerciseButton: false,
        };
        break;

      case 'super':
        originalConfigCopy = {
          ...this.superSetConfig,
          exercises: this.superSetConfig.exercises.map((e) => ({ ...e })),
        }; // Copia profunda array
        initialMode = 'exercise_reps';
        initialStateProps = {
          workoutTypeDisplay: 'Super Serie',
          totalSets: originalConfigCopy.sets,
          currentExerciseName: originalConfigCopy.exercises[0].name,
          currentTargetReps: originalConfigCopy.exercises[0].reps,
          showNextExerciseButton: originalConfigCopy.exercises.length > 1,
        };
        break;

      case 'timed':
        originalConfigCopy = {
          ...this.timedSetConfig,
          sets: this.timedSetConfig.sets || 1,
          restTime: this.timedSetConfig.restTime || 0,
        }; // Asegurar defaults
        initialMode = 'exercise_timed';
        initialStateProps = {
          workoutTypeDisplay: 'Por Tiempo',
          totalSets: originalConfigCopy.sets,
          currentExerciseName: originalConfigCopy.exerciseName,
          timeLeft: originalConfigCopy.duration,
          totalTime: originalConfigCopy.duration,
          progressPercentage: 0,
        };
        break;

      default: // Nunca debería ocurrir si canStartWorkout funciona
        console.error('Tipo de workout desconocido al iniciar.');
        return;
    }

    // Construir el objeto workoutState completo
    this.workoutState = {
      workoutType: this.selectedWorkoutType,
      workoutTypeDisplay: initialStateProps.workoutTypeDisplay || '', // Ensure a valid string
      mode: initialMode,
      currentSet: 1,
      currentExerciseIndex: 0, // Siempre empezamos con el primer ejercicio (índice 0)
      totalSets: initialStateProps.totalSets || 0, // Ensure totalSets is always a number
      currentExerciseName: initialStateProps.currentExerciseName || '', // Ensure a valid string
      originalConfig: originalConfigCopy,
      ...initialStateProps, // Mezcla las propiedades específicas del tipo
    };

    // Marcar como activo y notificar
    this.isWorkoutActive = true;
    console.log(
      'Workout Iniciado:',
      JSON.parse(JSON.stringify(this.workoutState))
    ); // Log profundo

    // Iniciar timer si el primer modo es timed
    if (this.workoutState && this.workoutState.mode === 'exercise_timed') {
      if (this.workoutState && this.workoutState.timeLeft !== null) {
        this.startTimer(
          this.workoutState.timeLeft ?? 0,
          this.workoutState.mode
        ); // Sabemos que timeLeft está definido aquí
      }
    }

    this.changeDetector.detectChanges(); // Actualizar UI
  }

  // Termina el workout y resetea el estado
  endWorkout() {
    console.log('Workout Terminado por el usuario.');
    this.clearTimerInterval();
    if (this.workoutState && this.workoutState.notifications) {
      LocalNotifications.cancel({
        notifications: this.workoutState?.notifications || [],
      }); // Cancelar notificaciones
      this.workoutState.notifications = []; // Limpiar notificaciones
    }
    this.workoutState = null;
    this.isWorkoutActive = false;
    // Opcional: ¿Resetear también selectedWorkoutType o los formularios? Depende de la UX deseada.
    // this.selectedWorkoutType = 'single';

    this.changeDetector.detectChanges();
  }

  // --- Métodos llamados por botones durante el Workout Activo ---

  // Botón "Serie Completada" (para 'exercise_reps')
  completeSet() {
    if (!this.workoutState || this.workoutState.mode !== 'exercise_reps')
      return;
    console.log(
      `Set ${this.workoutState.currentSet} completado para ${this.workoutState.currentExerciseName}`
    );
    this.moveToNextState(false); // false indica que no es cambio de ejercicio en superserie
  }

  // Botón "Siguiente Ejercicio" (para Super Series)
  nextExercise() {
    if (
      !this.workoutState ||
      this.workoutState.workoutType !== 'super' ||
      this.workoutState.mode !== 'exercise_reps'
    )
      return;
    console.log(
      `Siguiente ejercicio después de ${this.workoutState.currentExerciseName}`
    );
    this.moveToNextState(true); // true indica cambio de ejercicio dentro de la serie
  }

  // Botón "Saltar Descanso"
  skipRest() {
    if (
      !this.workoutState ||
      (this.workoutState.mode !== 'rest' &&
        this.workoutState.mode !== 'intra_set_rest')
    )
      return;
    console.log('Saltando descanso');
    this.clearTimerInterval();
    this.moveToNextState(); // Avanza al siguiente estado (debería ser un ejercicio)
  }

  // --- Lógica de Transición de Estados ---
  moveToNextState(isExerciseChange: boolean = false) {
    if (
      this.workoutState?.timeLeft !== undefined &&
      this.workoutState.timeLeft <= 0
    ) {
      console.log('El timer expiró mientras la app estaba cerrada.');
      this.moveToNextState();
    }

    // Guard Clause robusta
    if (!this.workoutState || !this.workoutState.originalConfig) {
      console.error('moveToNextState: Estado inválido.');
      this.endWorkout();
      return;
    }

    const state = this.workoutState; // Referencia corta
    const config = state.originalConfig; // Referencia corta a la config original
    let nextMode: WorkoutState['mode'] = 'finished';
    let nextSet = state.currentSet;
    let nextExerciseIndex = state.currentExerciseIndex;
    let restDuration = 0;
    let didStateChange = false; // Flag para saber si hubo transición

    // Lógica para determinar el siguiente estado
    switch (state.workoutType) {
      case 'single':
        if (
          state.mode === 'exercise_reps' &&
          state.currentSet < state.totalSets
        ) {
          nextMode = 'rest';
          restDuration = (config as SingleSetConfig).restTime;
          nextSet = state.currentSet + 1;
          didStateChange = true;
        } else if (state.mode === 'rest') {
          nextMode = 'exercise_reps'; // Volver al ejercicio para la siguiente serie
          didStateChange = true;
        }
        break; // Fin 'single'

      case 'super':
        const superConfig = config as SuperSetConfig;
        const isLastExerciseInSet =
          state.currentExerciseIndex >= superConfig.exercises.length - 1;

        if (state.mode === 'exercise_reps') {
          if (!isLastExerciseInSet) {
            // Si hay más ejercicios en la superserie
            nextMode = 'intra_set_rest';
            restDuration = superConfig.intraSetRestTime;
            nextExerciseIndex = state.currentExerciseIndex + 1;
            didStateChange = true;
          } else if (state.currentSet < state.totalSets) {
            // Si es el último ejercicio, pero no la última serie
            nextMode = 'rest'; // Descanso largo entre series
            restDuration = superConfig.interSetRestTime;
            nextSet = state.currentSet + 1;
            nextExerciseIndex = 0; // Reiniciar índice de ejercicio
            didStateChange = true;
          }
        } else if (state.mode === 'intra_set_rest') {
          // Si terminó el descanso corto entre ejercicios
          nextMode = 'exercise_reps'; // Pasar al siguiente ejercicio
          didStateChange = true;
        } else if (state.mode === 'rest') {
          // Si terminó el descanso largo entre series
          nextMode = 'exercise_reps'; // Volver al primer ejercicio de la siguiente serie
          didStateChange = true;
        }
        break; // Fin 'super'

      case 'timed':
        const timedConfig = config as TimedSetConfig;
        if (
          state.mode === 'exercise_timed' &&
          state.currentSet < state.totalSets
        ) {
          nextMode = 'rest';
          restDuration = timedConfig.restTime;
          nextSet = state.currentSet + 1;
          didStateChange = true;
        } else if (state.mode === 'rest') {
          nextMode = 'exercise_timed'; // Volver al ejercicio para la siguiente serie
          didStateChange = true;
        }
        break; // Fin 'timed'
    }

    // Si no hubo cambio de estado detectado, significa que terminamos
    if (!didStateChange) {
      nextMode = 'finished';
    }

    // --- Aplicar el Siguiente Estado ---
    if (nextMode === 'finished') {
      console.log('Workout completado!');
      LocalNotifications.cancel({
        notifications: this.workoutState?.notifications || [],
      }); // Cancelar notificaciones
      this.workoutState.notifications = []; // Limpiar notificaciones
      this.playWorkoutEndSound();
      this.endWorkout();
      return;
    }

    // Actualizar el estado existente (más eficiente que crear uno nuevo)
    state.mode = nextMode;
    state.currentSet = nextSet;
    state.currentExerciseIndex = nextExerciseIndex;

    // Limpiar propiedades opcionales
    state.timeLeft = undefined;
    state.totalTime = undefined;
    state.progressPercentage = undefined;
    state.currentTargetReps = undefined;
    state.showNextExerciseButton = false;

    // Configurar propiedades para el nuevo estado
    if (nextMode === 'exercise_reps') {
      let exerciseConfig: SuperSetExercise | SingleSetConfig;
      if (state.workoutType === 'single') {
        exerciseConfig = config as SingleSetConfig;
        state.currentExerciseName = exerciseConfig.exerciseName;
        state.currentTargetReps = exerciseConfig.reps;
      } else {
        // super
        const superExercises = (config as SuperSetConfig).exercises;
        // Validar índice por si acaso
        if (nextExerciseIndex < superExercises.length) {
          exerciseConfig = superExercises[nextExerciseIndex];
          state.currentExerciseName = exerciseConfig.name;
          state.currentTargetReps = exerciseConfig.reps;
          state.showNextExerciseButton =
            nextExerciseIndex < superExercises.length - 1;
        } else {
          console.error(
            'Índice de ejercicio inválido en súper serie:',
            nextExerciseIndex
          );
          this.endWorkout(); // Terminar si hay error
          return;
        }
      }
    } else if (nextMode === 'exercise_timed') {
      const timedConfig = config as TimedSetConfig;
      state.currentExerciseName = timedConfig.exerciseName;
      // Iniciar timer
      this.startTimer(timedConfig.duration, nextMode);
    } else if (nextMode === 'rest' || nextMode === 'intra_set_rest') {
      state.currentExerciseName = 'Descanso'; // Opcional: Mostrar "Descanso para X"
      // Iniciar timer
      this.startTimer(restDuration, nextMode);
    }

    this.playTransitionSound();
    console.log('Transición a:', JSON.parse(JSON.stringify(state)));
    this.changeDetector.detectChanges(); // Actualizar UI
  }

  // --- Lógica del Timer Interno ---

  startTimer(duration: number, mode: WorkoutState['mode']) {
    this.clearTimerInterval(); // Limpia cualquier timer anterior

    // Validar estado antes de iniciar timer
    if (!this.workoutState) {
      console.error('startTimer llamado sin workoutState activo.');
      return;
    }

    // Si la duración es 0 o menos, pasar directo al siguiente estado
    if (duration <= 0) {
      console.log(`Duración de timer <= 0 para modo ${mode}, saltando.`);
      // Usar setTimeout para evitar posible recursión infinita si varios descansos son 0
      setTimeout(() => this.moveToNextState(), 0);
      return;
    }

    // Actualizar estado ANTES de iniciar el intervalo
    this.workoutState.mode = mode; // Asegura que el modo sea correcto
    this.workoutState.timeLeft = duration;
    this.workoutState.totalTime = duration;
    this.workoutState.progressPercentage = 0;

    // Guardar el tiempo de inicio y finalización
    const now = Date.now();
    const endTime = now + duration * 1000; // Calcula el tiempo de finalización
    Preferences.set({
      key: 'workoutTimerState',
      value: JSON.stringify({
        isRunning: true,
        startTime: now,
        endTime: endTime,
        workoutState: {
          ...this.workoutState,
          currentSet: this.workoutState?.currentSet,
          currentExerciseIndex: this.workoutState?.currentExerciseIndex,
        },
      }),
    });

    console.log(`Iniciando timer (${mode}): ${duration}s`);

    this.sendNotification({
      at: new Date(endTime),
      allowWhileIdle: true
    }); // Programar notificación para el final del timer

    this.timerInterval = setInterval(() => {
      // Llamar a tick DENTRO del contexto de la clase
      this.tick();
    }, 1000);



    this.changeDetector.detectChanges(); // Actualizar UI inicial del timer
  }

  tick() {
    // Guard clause robusta para tick
    if (!this.workoutState || typeof this.workoutState.timeLeft !== 'number') {
      console.warn('tick llamado en estado inválido, deteniendo timer.');
      this.clearTimerInterval();
      // No llamar a endWorkout aquí, podría ser un estado intermedio inválido
      return;
    }

    this.workoutState.timeLeft--;
    this.calculateProgress(); // Calcular progreso

    if (this.workoutState.timeLeft < 0) {
      this.clearTimerInterval(); // Detener intervalo ANTES de procesar el fin
      this.handleTimerEnd(); // Procesar el fin del timer
    }
    // Forzar detección de cambios porque setInterval puede no dispararla en Angular
    this.changeDetector.detectChanges();
  }

  // Se llama sólo cuando el timer llega a 0
  handleTimerEnd() {
    if (!this.workoutState) return; // Guarda extra
    Preferences.remove({ key: 'workoutTimerState' });
    console.log(`Timer finalizado para modo: ${this.workoutState.mode}`);
    this.playTimerEndSound();
    this.moveToNextState(); // Decide qué hacer después
  }

  clearTimerInterval() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      console.log('Intervalo de timer limpiado.');
    }
  }

  calculateProgress() {
    // Guard clause robusta
    if (
      !this.workoutState ||
      typeof this.workoutState.timeLeft !== 'number' ||
      typeof this.workoutState.totalTime !== 'number' ||
      this.workoutState.totalTime <= 0
    ) {
      if (this.workoutState) this.workoutState.progressPercentage = 0; // Resetear si es posible
      return;
    }
    // Calcula el porcentaje COMPLETADO
    this.workoutState.progressPercentage =
      (this.workoutState.totalTime - this.workoutState.timeLeft) /
      this.workoutState.totalTime;
  }

  // --- Formateo y Sonidos (Implementación básica) ---
  formatTime(totalSeconds: number | null | undefined): string {
    if (
      totalSeconds === null ||
      totalSeconds === undefined ||
      totalSeconds < 0
    ) {
      totalSeconds = 0;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  // --- Placeholder para Sonidos ---
  playTimerEndSound() {
    console.log('🔊 Sonido Fin Timer');
  }
  playTransitionSound() {
    console.log('🔊 Sonido Transición');
  }
  playWorkoutEndSound() {
    console.log('🎉 Sonido Fin Workout');
  }

  async sendNotification(schedule: any = {}) {
    const notification = this.notificationServices.createLocalNotificationWithDefaults('¡Tiempo Terminado!', this.determineNotificationBody(),
    schedule, "Important");
    const resolvedNotification = await notification;
    this.notificationServices.createNotification(new NotificationMessage(resolvedNotification.id, resolvedNotification)).then(() => {
          return this.toastCtrl.create({
            message: resolvedNotification.body,
            duration: 2000,
            color: 'success',
          });
        })
        .catch((error) => {
          return this.toastCtrl.create({
            message: 'Error al enviar la notificacion: ' + error,
            duration: 2000,
            color: 'danger',
          });
        });

      const toast = await this.toastCtrl.create({
        message: resolvedNotification.body,
        duration: 2000,
        color: 'success',
      });

      if (toast) {
        await toast.present();
      }
  }

  // Función helper para el cuerpo de la notificación
  determineNotificationBody(): string {
    if (!this.workoutState) return 'Es hora de continuar.'; // Fallback genérico

    const state = this.workoutState;
    //mode: 'exercise_reps' | 'exercise_timed' | 'rest' | 'intra_set_rest' | 'finished';
    switch (state.mode) {
      case 'exercise_timed':
        return `¡Ejercicio ${
          this.workoutState?.currentExerciseName || ''
        } terminado!`;
      case 'rest':
        return 'Descanso terminado. ¡Prepárate para la siguiente serie!';
      case 'intra_set_rest':
        return 'Descanso corto terminado. ¡Siguiente ejercicio!';
      case 'exercise_reps':
        return `¡Repeticion de ejercicio ${
          this.workoutState?.currentExerciseName || ''
        } terminado!`;
      default:
        return 'Intervalo completado.';
    }
  }
} // Fin de la clase WorkoutPage
