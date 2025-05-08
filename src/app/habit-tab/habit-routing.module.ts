import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HabitPage } from './habit.page';

const routes: Routes = [
  {
    path: '',
    component: HabitPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HabitPageRoutingModule {}
