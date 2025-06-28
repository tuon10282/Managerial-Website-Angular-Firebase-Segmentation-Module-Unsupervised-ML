import { TestBed } from '@angular/core/testing';

import { RFMCalculatorService } from './rfm-calculator.service';

describe('RFMCalculatorService', () => {
  let service: RFMCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RFMCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
