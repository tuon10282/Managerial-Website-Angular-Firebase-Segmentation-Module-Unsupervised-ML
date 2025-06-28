import { TestBed } from '@angular/core/testing';

import { RfmService } from './rfm.service';

describe('RfmService', () => {
  let service: RfmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RfmService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
