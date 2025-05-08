import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkoutPage } from './workout.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { WorkoutPageRoutingModule } from './workout-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    WorkoutPageRoutingModule
  ],
  declarations: [WorkoutPage]
})
export class WorkoutPageModule {}
