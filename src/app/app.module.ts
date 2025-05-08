import { CUSTOM_ELEMENTS_SCHEMA, LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { registerLocaleData } from '@angular/common';
import localeEsCR from '@angular/common/locales/es-CR'; // <-- Importa los datos para es-CR
import { NotificationServices } from './services/NotificationServices';
import { StorageServices } from './services/StorageServices';
import { FocusTimerServices } from './services/FocusTimerServices';
import { AppForegroundService } from './services/AppForegroundService';
registerLocaleData(localeEsCR);
@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }, NotificationServices, StorageServices, FocusTimerServices, AppForegroundService, {provide: LOCALE_ID, useValue: 'es-CR'}], // <-- Proporciona el servicio
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
