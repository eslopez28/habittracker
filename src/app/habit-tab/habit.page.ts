import { Habit as ImportedHabit } from './habit.page';
// src/app/pages/habits/habits.page.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
// Quitamos imports de CommonModule, FormsModule, IonicModule de aquí
import {
  ModalController,
  AlertController,
  LoadingController,
} from '@ionic/angular'; // Controller imports sí van aquí

// Importaciones de Servicios y Componentes (Necesitan ser creados/importados en el módulo)
import { HabitFormComponent } from '../component/habit-form/habit-form.component';
import { Preferences } from '@capacitor/preferences';
import { h } from 'ionicons/dist/types/stencil-public-runtime';
import { LocalNotifications, LocalNotificationSchema, ScheduleOptions } from '@capacitor/local-notifications';

// --- Interfaces (Puedes mantenerlas aquí o moverlas a un archivo .model.ts) ---
export interface Habit {
  id: number;
  name: string;
  time?: string;
  frequency: number;
  createdAt: string;
  completions: HabitCompletionRecord[];
}

export interface HabitCompletionRecord {
  reservedDate: Date;
  isCompleted: boolean;
}

@Component({
  selector: 'app-habits',
  templateUrl: './habit.page.html',
  styleUrls: ['./habit.page.scss'],
  standalone: false, // No es standalone
})
export class HabitPage implements OnInit, OnDestroy {
  // --- Propiedades para la UI ---
  currentView: 'daily' | 'weekly' = 'daily';
  selectedDate: string = new Date().toISOString();
  selectedWeekDisplay: string = '';
  isLoading: boolean = true;

  // --- Datos (Ahora vienen del servicio) ---
  public allHabits: Habit[] = [];

  // --- Datos Filtrados para Mostrar ---
  dailyHabits: any[] = [];

  // --- Constructor y Ciclo de Vida ---
  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private changeDetector: ChangeDetectorRef
  ) {
    Preferences.get({
      key: 'appConfig',
    }).then((res) => {
      this.appConfig = JSON.parse(res.value || '{}');
      console.log('Configuración de la app:', this.appConfig);
      this.minDate = new Date(this.appConfig.firstExecutionDate).toISOString();
    });
    this.maxDate = new Date().toISOString();
  }

  private appConfig: any;
  public maxDate: string;
  public minDate!: string;

  async ngOnInit() {
    console.log('HabitsPage OnInit (NgModule)');
    const habits = await Preferences.get({ key: 'habits' }).then((res) =>
      JSON.parse(res.value || '[]')
    );
    this.allHabits = Array.isArray(habits) ? habits : [];
    this.updateWeekDisplay();
  }

  ngOnDestroy() {
    console.log('HabitsPage OnDestroy');
  }

  // --- Métodos de Cambio de Vista/Fecha/Semana ---
  // (Estos métodos no cambian respecto a la versión anterior)
  viewChanged(event?: any) {
    console.log('Vista cambiada a:', this.currentView);
    this.filterHabitsForView();
  }

  isPreviousDayDisabled(): boolean {
    const currentDate = new Date(this.selectedDate);
    const previousDay = new Date(currentDate);
    previousDay.setDate(currentDate.getDate() - 1); // Calcula el día anterior
    const minDate = new Date(this.minDate);
    return previousDay < minDate; // Compara el día anterior con la fecha mínima
  }

  isNextDayDisabled(): boolean {
    const currentDate = new Date(this.selectedDate);
    const maxDate = new Date(this.maxDate);
    return currentDate >= maxDate;
  }

  dateChanged() {
    console.log('Fecha seleccionada:', this.selectedDate);
    this.filterHabitsForView();
    const popover = document
      .getElementById('open-date-picker')
      ?.parentElement?.querySelector('ion-popover');
    if (popover) {
      popover.dismiss();
    }
  }

  changeDay(offset: number) {
    const currentDate = new Date(this.selectedDate);
    currentDate.setDate(currentDate.getDate() + offset);
    this.selectedDate = currentDate.toISOString();
    this.filterHabitsForView();
  }

  changeWeek(offset: number) {
    const currentDate = new Date(this.selectedDate);
    const dayOfWeek = currentDate.getDay();
    const diffToMonday =
      currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mondayOfCurrentWeek = new Date(currentDate.setDate(diffToMonday));
    const mondayOfNewWeek = new Date(mondayOfCurrentWeek);
    mondayOfNewWeek.setDate(mondayOfCurrentWeek.getDate() + offset * 7);
    this.selectedDate = mondayOfNewWeek.toISOString();
    this.updateWeekDisplay();
    this.filterHabitsForView();
  }

  updateWeekDisplay() {
    const date = new Date(this.selectedDate);
    const { weekStartDate, weekEndDate } = this.getCurrentWeekRange(date);
    const formatter = new Intl.DateTimeFormat('es-CR', {
      day: 'numeric',
      month: 'short',
    });
    this.selectedWeekDisplay = `Semana (${formatter.format(
      weekStartDate
    )} - ${formatter.format(weekEndDate)})`;
  }

  // --- Lógica Principal de Filtrado y Preparación ---
  // (Estos métodos no cambian respecto a la versión anterior)
  filterHabitsForView() {
    console.log('Filtrando hábitos para la vista:', this.currentView);
    console.log('Hábitos disponibles:', this.allHabits);

    if (this.isLoading) {
      console.log('Cargando datos, no se puede filtrar aún.');
      return;
    }

    this.changeDetector.detectChanges();
  }


  // --- Métodos de Interacción (CRUD y Completado) ---
  // (Estos métodos llaman al DatabaseService y su lógica interna no cambia)

  async openAddHabitModal() {
    console.log('Abrir modal para añadir hábito (NgModule)');
    try {
      const modal = await this.modalCtrl.create({
        component: HabitFormComponent, // El componente modal
        componentProps: { isEditMode: false },
      });
      await modal.present();
      const { data, role } = await modal.onWillDismiss();
      if (role === 'confirm' && data) {
        await this.addHabit(data);
      }
    } catch (error) {
      console.error('Error al abrir/procesar modal de añadir:', error);
      await this.presentErrorAlert('Error', 'No se pudo abrir el formulario.');
    }
  }

  async editHabit(habit: Habit) {
    console.log('Abrir modal para editar hábito:', habit);
    try {
      const modal = await this.modalCtrl.create({
        component: HabitFormComponent,
        componentProps: { isEditMode: true, habitData: { ...habit } },
      });
      await modal.present();
      const { data, role } = await modal.onWillDismiss();
      if (role === 'confirm' && data) {
        await this.updateHabit(data);
      }
    } catch (error) {
      console.error('Error al abrir/procesar modal de editar:', error);
      await this.presentErrorAlert('Error', 'No se pudo abrir el formulario.');
    }
  }

  async addHabit(newHabitData: Omit<Habit, 'id' | 'createdAt'>) {
    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();
    try {
      if (
        this.allHabits.some(
          (h) =>
            h.name.trim().toLowerCase() ===
            newHabitData.name.trim().toLowerCase()
        )
      ) {
        await this.presentErrorAlert(
          'Error',
          'Ya existe un hábito con ese nombre.'
        );
        return;
      }
      const newHabit: Habit = {
        id: Math.floor(Date.now() % 100000), // Generate a unique ID
        createdAt: new Date().toISOString(), // Set the current timestamp
        frequency: newHabitData.frequency,
        name: newHabitData.name,
        completions: [
          {
            reservedDate: new Date(this.selectedDate),
            isCompleted: false,
          },
        ],
      };
      this.allHabits = [...this.allHabits, newHabit]; // Asegúrate de que siga siendo un array
      await Preferences.set({
        key: 'habits',
        value: JSON.stringify(this.allHabits),
      });
      this.filterHabitsForView();
    } catch (error) {
      console.error('Error añadiendo hábito:', error);
      await this.presentErrorAlert(
        'Error al Guardar',
        'No se pudo añadir el hábito.'
      );
    } finally {
      await loading.dismiss();
    }
  }

  async updateHabit(updatedHabitData: Habit) {
    const loading = await this.loadingCtrl.create({
      message: 'Actualizando...',
    });
    await loading.present();
    try {
      const index = this.allHabits.findIndex(
        (h) => h.id === updatedHabitData.id
      );
      if (index > -1) this.allHabits[index] = updatedHabitData; // Actualizar caché local
      await Preferences.set({
        key: 'habits',
        value: JSON.stringify(this.allHabits),
      });
      this.filterHabitsForView();
    } catch (error) {
      console.error('Error actualizando hábito:', error);
      await this.presentErrorAlert(
        'Error al Actualizar',
        'No se pudo actualizar el hábito.'
      );
    } finally {
      await loading.dismiss();
    }
  }

  async deleteHabit(habitToDelete: Habit) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Borrado',
      message: `¿Eliminar "${habitToDelete.name}" y todos sus registros?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Eliminando...',
            });
            await loading.present();
            try {
              this.allHabits = this.allHabits.filter(
                (h) => h.id !== habitToDelete.id
              );
              await Preferences.set({
                key: 'habits',
                value: JSON.stringify(this.allHabits),
              });
              this.filterHabitsForView();
            } catch (error) {
              console.error('Error eliminando hábito:', error);
              await this.presentErrorAlert(
                'Error al Eliminar',
                'No se pudo eliminar el hábito.'
              );
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  isHabitCompleted(habit: Habit): boolean {
    const today = new Date(this.selectedDate);
    const completion = habit.completions?.find(
      (c) => this.formatDate(new Date(c.reservedDate)) === this.formatDate(today)
    );
    if (completion) {
      return completion.isCompleted;
    }
    return false; // Si no hay completions, devuelve false
  }

  async toggleDailyCompletion(habitUI: any) {
    const habit = this.allHabits.find(h => h.id === habitUI.id);
    if (!habit) {
      console.error('Hábito no encontrado:', habitUI.id);
      await this.presentErrorAlert('Error', 'Hábito no encontrado.');
      return;
    }

    try {
      debugger;
      const completion = habit.completions.find((c) => this.formatDate(new Date(c.reservedDate)) === this.formatDate(new Date(this.selectedDate)));
      if (completion) {
        completion.isCompleted = !completion.isCompleted;
      } else {
        habit.completions.push({
          reservedDate: new Date(this.selectedDate),
          isCompleted: habitUI.completedToday,
        });
      }
      this.updateHabit(habit);
      this.filterHabitsForView(); // Refrescar la vista actual
    } catch (error) {
      console.error('Error al actualizar completado:', error);
      await this.presentErrorAlert(
        'Error',
        'No se pudo actualizar el estado del hábito.'
      );
      // Revertir visualmente el checkbox
      habitUI.completedToday = !habitUI.completedToday;
      this.changeDetector.detectChanges();
    }
  }

  // --- Funciones Auxiliares ---
  // (Estas funciones no cambian respecto a la versión anterior)
  formatDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return formatter.format(date);
  }
  formatDateToKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `<span class="math-inline">\{year\}\-</span>{month}-${day}`;
  }
  getCurrentWeekRange(date: Date): { weekStartDate: Date; weekEndDate: Date } {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { weekStartDate: monday, weekEndDate: sunday };
  }
  formatTime(timeString: string | null | undefined): string {
    return timeString ? timeString : '';
  }
  async presentErrorAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  async sendNotification(habit: Habit) {
    // ... (tu lógica para determinar el siguiente estado) ...

    // --- Programar Notificación ---
      try {
        // Define la notificación
        const notification: LocalNotificationSchema = {
          id: Math.floor(Date.now() % 100000), // ID único (timestamp simple funciona para notificaciones inmediatas)
          title: `¡Tiempo Terminado!`,
          body: `Es hora de ${habit.name}`,
          schedule: {
            at: habit.time ? new Date(habit.time) : undefined, // Programar para la frecuencia del hábito
            every: 'day',

          },
          // schedule: { at: new Date(Date.now() + 100) } // Programar para casi inmediato
          // O simplemente enviar sin 'schedule' para mostrar ya (depende versión plugin)
           smallIcon: 'res://mipmap/ic_launcher', // Usa el icono por defecto de la app (Android)
           sound: undefined // Usa el sonido por defecto del sistema
        };

        console.log('Programando notificación:', notification.id);
        await LocalNotifications.schedule({ notifications: [notification] }).then(async () => {
          const toast = await this.alertCtrl.create({
            message: 'Notificación programada con éxito',
            buttons: ['OK'],
          });
          toast.present();
          return toast;
        }).catch((error) => {
          return this.alertCtrl.create({
            message: 'Error programando notificación: ' + error,
            buttons: ['OK'],
          }).then((toast) => {
            toast.present();
            return toast;
          }); // Manejo de errores
        }); // Close the catch block
      } catch (e) {
        console.error("Error programando notificación:", e);
      }
    // --- Fin Programar Notificación ---

    // ... (resto de tu lógica para preparar/iniciar el siguiente intervalo) ...
  }

} // Fin clase HabitsPage
