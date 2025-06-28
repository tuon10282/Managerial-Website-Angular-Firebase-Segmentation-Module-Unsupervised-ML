import { Injectable, inject } from '@angular/core';
import { 
  Firestore,
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy, 
  limit,
  deleteDoc
} from '@angular/fire/firestore';
import { RFMMetrics, RFMSegmentation } from '../classes/RFM';
import { RFMCalculatorService } from './rfm-calculator.service';
import { KMeansService } from './kmeans.service';

@Injectable({
  providedIn: 'root'
})
export class RfmService {
  private firestore = inject(Firestore);
  private rfmCalculator = inject(RFMCalculatorService);
  private kmeansService = inject(KMeansService);

  private readonly COLLECTIONS = {
    RFM_SEGMENTATION: 'RFMSegmentation'
  };

  // Kiểm tra xem có cần chạy segmentation không (mỗi 7 ngày)
  async shouldRunSegmentation(): Promise<boolean> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return true;

      const lastSegmentation = snapshot.docs[0].data();
      const lastDate = new Date(lastSegmentation['created_at']);
      const currentDate = new Date();
      const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      return daysDiff >= 7;
    } catch (error) {
      console.error('Error checking segmentation schedule:', error);
      return true; // Nếu có lỗi, chạy phân khúc
    }
  }

  // Chạy toàn bộ quy trình RFM với K-means
// Chạy toàn bộ quy trình RFM với K-means
async runRFMAnalysis(): Promise<void> {
  try {
    console.log('Starting RFM Analysis...');
    
    // 1. Tính toán RFM metrics (đã có RFM score)
    const rawMetrics = await this.rfmCalculator.calculateRFMMetrics();
    console.log(`Calculated metrics for ${rawMetrics.length} customers`);

    if (rawMetrics.length === 0) {
      console.log('No customers with orders found');
      return;
    }

    // 2. Chạy K-means clustering để gán segment
    const { clusteredMetrics } = await this.kmeansService.performKMeansClustering(rawMetrics);
    console.log('K-means clustering completed');

    // 3. Lưu kết quả - FIX: Pass clusteredMetrics instead of rawMetrics
    await this.saveSegmentation(clusteredMetrics);
    console.log('RFM Analysis completed successfully');

  } catch (error) {
    console.error('Error in RFM Analysis:', error);
    throw error;
  }
}

  // Lưu kết quả phân khúc vào Firebase
  private async saveSegmentation(metrics: (RFMMetrics & { cluster_id: number, segment: string })[]): Promise<void> {
    try {
      // Xóa dữ liệu cũ trước khi lưu mới
      await this.clearOldSegmentation();

      const batch = [];
      const currentTime = new Date().toISOString();

      for (const metric of metrics) {
        const segmentationData: Omit<RFMSegmentation, 'id'> = {
          user_id: metric.user_id,
          recency: metric.recency,
          frequency: metric.frequency,
          monetary: metric.monetary,
          rfm_score: metric.rfm_score,
          segment: metric.segment,
          cluster_id: metric.cluster_id,
          created_at: currentTime,
          updated_at: currentTime
        };

        batch.push(
          addDoc(collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION), segmentationData)
        );
      }

      await Promise.all(batch);
      console.log('RFM Segmentation saved successfully');
    } catch (error) {
      console.error('Error saving segmentation:', error);
      throw error;
    }
  }

  // Xóa dữ liệu phân khúc cũ
  private async clearOldSegmentation(): Promise<void> {
    try {
      const q = query(collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
      console.log('Old segmentation data cleared');
    } catch (error) {
      console.error('Error clearing old segmentation:', error);
    }
  }

  // Lấy phân khúc của một customer
  async getCustomerSegmentation(userId: string): Promise<RFMSegmentation | null> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;

      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RFMSegmentation;
    } catch (error) {
      console.error('Error getting customer segmentation:', error);
      return null;
    }
  }

  // Lấy tất cả phân khúc hiện tại
  async getAllSegmentations(): Promise<RFMSegmentation[]> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        orderBy('created_at', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as RFMSegmentation));
    } catch (error) {
      console.error('Error getting all segmentations:', error);
      return [];
    }
  }

  // Lấy phân khúc theo segment
  async getSegmentationBySegment(segment: string): Promise<RFMSegmentation[]> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.RFM_SEGMENTATION),
        where('segment', '==', segment),
        orderBy('monetary', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as RFMSegmentation));
    } catch (error) {
      console.error('Error getting segmentation by segment:', error);
      return [];
    }
  }
}