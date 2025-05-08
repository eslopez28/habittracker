import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FocusTimer } from './focus.timer.page';

const routes: Routes = [
  {
    path: '',
    component: FocusTimer,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FocusTimerRoutingModule {}
