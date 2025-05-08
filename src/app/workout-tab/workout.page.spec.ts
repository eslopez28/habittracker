import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { WorkoutPage } from './workout.page';

describe('WorkoutPage', () => {
  let component: WorkoutPage;
  let fixture: ComponentFixture<WorkoutPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WorkoutPage],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkoutPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
