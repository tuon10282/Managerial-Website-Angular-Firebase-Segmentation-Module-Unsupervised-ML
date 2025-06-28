import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { CustomerManagmentComponent } from './customer-managment/customer-managment.component';
import { PannelComponent } from './pannel/pannel.component';
import { FormsModule } from '@angular/forms';
import { FeedbackComponent } from './feedback/feedback.component';
import { CommonModule } from '@angular/common';
import { CustomerSegmentationComponent } from './customer-segmentation/customer-segmentation.component';

@NgModule({
  declarations: [
    AppComponent,
    CustomerManagmentComponent,
    PannelComponent,
    FeedbackComponent,
    CustomerSegmentationComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    CommonModule
  ],
  providers: [
    provideFirebaseApp(() => initializeApp({ projectId: "calmpuchia", appId: "1:671019972423:web:594e78038ebeff2b347e62", databaseURL: "https://calmpuchia-default-rtdb.firebaseio.com", storageBucket: "calmpuchia.firebasestorage.app", apiKey: "AIzaSyBSOqsmk92hutsxCWH2oi1g8sZ-_ci93Qk", authDomain: "calmpuchia.firebaseapp.com", messagingSenderId: "671019972423", measurementId: "G-N4KDS55TBG" })),
    provideFirestore(() => getFirestore())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
