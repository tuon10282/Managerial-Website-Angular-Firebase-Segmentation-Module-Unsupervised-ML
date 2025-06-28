// src/app/services/segmentation-scheduler.service.ts
import { RfmService } from './rfm.service';
import { Injectable } from '@angular/core';

export class SegmentationSchedulerService {
  private rfmService: RfmService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.rfmService = new RfmService();
  }

  // Bắt đầu scheduler (chạy mỗi ngày lúc 2:00 AM)
  start(): void {
    // Tính toán thời gian đến 2:00 AM tiếp theo
    const now = new Date();
    const next2AM = new Date();
    next2AM.setHours(2, 0, 0, 0);
    
    if (next2AM <= now) {
      next2AM.setDate(next2AM.getDate() + 1);
    }

    const timeUntilNext2AM = next2AM.getTime() - now.getTime();

    // Chạy lần đầu tại 2:00 AM tiếp theo
    setTimeout(() => {
      this.checkAndRunSegmentation();
      
      // Sau đó chạy mỗi 24 giờ
      this.intervalId = setInterval(() => {
        this.checkAndRunSegmentation();
      }, 24 * 60 * 60 * 1000); // 24 giờ

    }, timeUntilNext2AM);

    console.log(`Segmentation scheduler started. Next run at: ${next2AM.toISOString()}`);
  }

  // Dừng scheduler
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Segmentation scheduler stopped');
    }
  }

  // Kiểm tra và chạy phân khúc nếu cần
  private async checkAndRunSegmentation(): Promise<void> {
    try {
      const shouldRun = await this.rfmService.shouldRunSegmentation();
      
      if (shouldRun) {
        console.log('Running scheduled RFM segmentation...');
        await this.rfmService.runRFMAnalysis();
        console.log('Scheduled RFM segmentation completed');
      } else {
        console.log('RFM segmentation not needed yet');
      }
    } catch (error) {
      console.error('Error in scheduled segmentation:', error);
    }
  }

  // Chạy thủ công
  async runManually(): Promise<void> {
    console.log('Running manual RFM segmentation...');
    await this.rfmService.runRFMAnalysis();
    console.log('Manual RFM segmentation completed');
  }
}