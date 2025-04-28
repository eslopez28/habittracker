// src/app/components/habit-form/habit-form.component.ts
import { Component, Input, OnInit } from '@angular/core';
// Quitamos imports de CommonModule, FormsModule, IonicModule de aquí
import { ModalController, ToastController } from '@ionic/angular';

// Asume que la interfaz se importa o define aquí (o en un archivo .model.ts)
interface HabitFormData {
   id?: number;
   name: string;
   time?: string;
   frequency: number;
}

@Component({
  selector: 'app-habit-form',
  templateUrl: './habit-form.component.html',
  styleUrls: ['./habit-form.component.scss'],
  standalone: false
  // NO hay standalone: true
  // NO hay array 'imports' aquí
})
export class HabitFormComponent implements OnInit {

  @Input() isEditMode: boolean = false;
  @Input() habitData: Partial<HabitFormData> = { name: '', frequency: 7, time: '' };
  formData: HabitFormData = { name: '', frequency: 7, time: undefined };
  modalTitle: string = '';

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.modalTitle = this.isEditMode ? 'Editar Hábito' : 'Añadir Nuevo Hábito';
    if (this.isEditMode && this.habitData) {
      this.formData = { ...this.habitData } as HabitFormData;
       if(this.formData.frequency === null || this.formData.frequency === undefined){
           this.formData.frequency = 7;
       }
    } else {
       this.formData = { name: '', frequency: 7, time: undefined };
    }
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  async confirm() {
    if (this.validateForm()) {
      await this.modalCtrl.dismiss(this.formData, 'confirm');
    } else {
       await this.presentToast('Por favor, completa todos los campos requeridos (Nombre y Frecuencia).');
    }
  }

  validateForm(): boolean {
    const nameIsValid = !!this.formData.name?.trim();
    const frequencyIsValid = typeof this.formData.frequency === 'number' && this.formData.frequency >= 1 && this.formData.frequency <= 7;
    console.log('Validación:', { nameIsValid, frequencyIsValid });
    // Aquí puedes agregar más validaciones si es necesario
    console.log('Datos del formulario:', this.formData);
    return nameIsValid && frequencyIsValid;
  }

   async presentToast(message: string, duration: number = 2000, color: string = 'warning') {
    const toast = await this.toastCtrl.create({ message, duration, color, position: 'top' });
    await toast.present();
  }

} // Fin de la clase HabitFormComponent
