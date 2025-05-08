import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { FocusTimer } from './focus.timer.page';

describe('FocusTimer', () => {
  let component: FocusTimer;
  let fixture: ComponentFixture<FocusTimer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FocusTimer],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(FocusTimer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
