import { TestBed } from '@angular/core/testing';

import { SegmentationSchedulerService } from './segmentation-scheduler.service';

describe('SegmentationSchedulerService', () => {
  let service: SegmentationSchedulerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SegmentationSchedulerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
