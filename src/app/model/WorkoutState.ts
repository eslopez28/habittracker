import { TimerProperties } from "./TimerProperties";


interface SingleSetConfig {
  exerciseName: string;
  sets: number;
  reps: number;
  restTime?: number; // segundos
}

interface SuperSetConfig {
  sets: number;
  intraSetRestTime: number; // segundos (entre ejercicios)
  interSetRestTime: number; // segundos (entre series completas)
  exercises: SingleSetConfig[];
}

interface TimedSetConfig {
  duration: number; // segundos
  exercise: SingleSetConfig;
}

export class WorkoutState {
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
  showNextExerciseButton?: boolean; // Opcional: solo para super series
  // Guarda una copia de la configuración original para referencia fácil
  originalConfig!: SingleSetConfig | SuperSetConfig | TimedSetConfig;
  timer!: TimerProperties

  constructor() {
    this.workoutType = 'single';;
    this.workoutTypeDisplay = 'Serie Simple';
    this.mode = 'exercise_reps';
    this.totalSets = 3;
    this.currentSet = 1;
    this.currentExerciseIndex = 0;
    this.currentExerciseName = '';
  }


}
