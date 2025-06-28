import { Component, inject } from '@angular/core';
import { RFMSegmentation } from '../../classes/RFM';
import { RfmService } from '../rfm.service';

@Component({
  selector: 'app-customer-segmentation',
  standalone: false,
  templateUrl: './customer-segmentation.component.html',
  styleUrl: './customer-segmentation.component.css'
})
export class CustomerSegmentationComponent {
  private rfmService = inject(RfmService);

  // State variables
  segmentations: RFMSegmentation[] = [];
  displayedSegmentations: RFMSegmentation[] = [];
  selectedSegment: string = '';
  isRunning: boolean = false;
  isLoading: boolean = false;
  statusMessage: string = '';
  statusType: 'success' | 'error' | 'info' = 'info';
  shouldRun: boolean = false;

  ngOnInit() {
    this.loadSegmentations();
    this.checkSchedule();
  }

  // Chạy RFM Analysis
  async runAnalysis() {
    this.isRunning = true;
    this.setStatus('Đang bắt đầu phân tích RFM...', 'info');

    try {
      await this.rfmService.runRFMAnalysis();
      this.setStatus('RFM Analysis hoàn thành thành công!', 'success');
      
      // Tự động load lại data sau khi chạy xong
      setTimeout(() => {
        this.loadSegmentations();
      }, 1000);
      
    } catch (error) {
      console.error('Error running RFM analysis:', error);
      this.setStatus('Có lỗi xảy ra khi chạy RFM Analysis!', 'error');
    } finally {
      this.isRunning = false;
    }
  }

  // Load tất cả segmentations
  async loadSegmentations() {
    this.isLoading = true;
    this.setStatus('Đang tải dữ liệu...', 'info');

    try {
      this.segmentations = await this.rfmService.getAllSegmentations();
      this.displayedSegmentations = [...this.segmentations];
      
      if (this.segmentations.length > 0) {
        this.setStatus(`Đã tải ${this.segmentations.length} khách hàng`, 'success');
      } else {
        this.setStatus('Không có dữ liệu. Hãy chạy RFM Analysis trước!', 'info');
      }
    } catch (error) {
      console.error('Error loading segmentations:', error);
      this.setStatus('Có lỗi khi tải dữ liệu!', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Kiểm tra lịch trình
  async checkSchedule() {
    try {
      this.shouldRun = await this.rfmService.shouldRunSegmentation();
      if (this.shouldRun) {
        this.setStatus('Cần chạy segmentation mới (đã quá 7 ngày)', 'info');
      } else {
        this.setStatus('Segmentation vẫn còn mới (dưới 7 ngày)', 'success');
      }
    } catch (error) {
      console.error('Error checking schedule:', error);
      this.setStatus('Có lỗi khi kiểm tra lịch trình', 'error');
    }
  }

  // Lọc theo segment
  filterBySegment() {
    if (this.selectedSegment) {
      this.displayedSegmentations = this.segmentations.filter(
        s => s.segment === this.selectedSegment
      );
    } else {
      this.displayedSegmentations = [...this.segmentations];
    }
  }

  // Đếm số lượng theo segment
  getSegmentCount(segment: string): number {
    return this.segmentations.filter(s => s.segment === segment).length;
  }

  // Format tiền tệ
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  // Format ngày
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Set status message
  private setStatus(message: string, type: 'success' | 'error' | 'info') {
    this.statusMessage = message;
    this.statusType = type;
    
    // Auto clear message after 5 seconds
    setTimeout(() => {
      this.statusMessage = '';
    }, 5000);
  }

  // Get CSS class cho segment badge
  getSegmentClass(segment: string): string {
    switch (segment) {
      case 'VIP':
        return 'segment-vip';
      case 'Loyal':
        return 'segment-loyal';
      case 'potential':
        return 'segment-potential';
      case 'Pay Attention':
        return 'segment-care';
      default:
        return 'segment-default';
    }
  }

  // Test một customer cụ thể
  async testCustomerSegmentation(userId: string) {
    try {
      const result = await this.rfmService.getCustomerSegmentation(userId);
      if (result) {
        this.setStatus(`Customer ${userId}: ${result.segment}`, 'success');
      } else {
        this.setStatus(`Không tìm thấy dữ liệu cho customer ${userId}`, 'error');
      }
    } catch (error) {
      console.error('Error testing customer:', error);
      this.setStatus('Có lỗi khi test customer', 'error');
    }
  }

}
