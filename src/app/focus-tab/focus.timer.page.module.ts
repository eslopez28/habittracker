import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FocusTimer } from './focus.timer.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { FocusTimerRoutingModule } from './focus.timer.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    FocusTimerRoutingModule
  ],
  declarations: [FocusTimer]
})
export class FocusTimerModule {}
