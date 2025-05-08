import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitPage } from './habit.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { HabitPageRoutingModule } from './habit-routing.module';
import { HabitFormComponent } from '../component/habit-form/habit-form.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    HabitPageRoutingModule
  ],
  declarations: [HabitPage, HabitFormComponent]
})
export class HabitPageModule {}
