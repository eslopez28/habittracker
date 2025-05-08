import { FocusTimer } from "./FocusTimer";

export class TimerProperties {
  config: FocusTimer = new FocusTimer(25, 5, 15, 4); // Configuración del temporizador

  timeLeft: number = 0; // en segundos
  totalTime: number = 0; // en segundos
  endTime?: number; // Fecha y hora de inicio del temporizador
  endDate?: Date; // Fecha y hora de fin del temporizador
  currentMode: 'focus' | 'shortBreak' | 'longBreak' | 'idle' = 'idle';
  currentIntervalNumber: number = 1; // # de intervalo de enfoque actual
  isRunning: boolean = false;
  isPaused: boolean = false;
  isFinished: boolean = false; // Indica si el temporizador ha terminado
  timerVisible: boolean = false;
  timerInterval? : any;
  progressPercentage?: number;
  currentModeDisplay?: string;

  public newConfig() : TimerProperties{
    const newConfig = new TimerProperties();
    newConfig.config = this.config;
    return newConfig;
  }

}
