import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerManagmentComponent } from './customer-managment.component';

describe('CustomerManagmentComponent', () => {
  let component: CustomerManagmentComponent;
  let fixture: ComponentFixture<CustomerManagmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CustomerManagmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerManagmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
