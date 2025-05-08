import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'tab1',
        loadChildren: () => import('../focus-tab/focus.timer.page.module').then(m => m.FocusTimerModule)
      },
      {
        path: 'tab2',
        loadChildren: () => import('../habit-tab/habit.module').then(m => m.HabitPageModule)
      },
      {
        path: 'tab3',
        loadChildren: () => import('../workout-tab/workout.module').then(m => m.WorkoutPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/tab2',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/tab2',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
